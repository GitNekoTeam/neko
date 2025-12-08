import { BaseProvider } from '../../api/providers/BaseProvider';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

export interface CondenseOptions {
    maxTokens: number;
    preserveRecent: number;
    preserveSystem: boolean;
    summaryPrompt?: string;
}

export interface CondenseResult {
    messages: Message[];
    summary?: string;
    originalCount: number;
    condensedCount: number;
    tokensSaved: number;
}

export class ContextCondenser {
    private provider: BaseProvider | null = null;
    private defaultOptions: CondenseOptions = {
        maxTokens: 8000,
        preserveRecent: 4,
        preserveSystem: true,
        summaryPrompt: 'Summarize the following conversation concisely, preserving key decisions, code changes, and important context:'
    };

    setProvider(provider: BaseProvider): void {
        this.provider = provider;
    }

    async condense(messages: Message[], options?: Partial<CondenseOptions>): Promise<CondenseResult> {
        const opts = { ...this.defaultOptions, ...options };
        const originalCount = messages.length;

        if (messages.length <= opts.preserveRecent + 1) {
            return {
                messages,
                originalCount,
                condensedCount: messages.length,
                tokensSaved: 0
            };
        }

        const systemMessages = opts.preserveSystem 
            ? messages.filter(m => m.role === 'system')
            : [];
        
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const recentMessages = nonSystemMessages.slice(-opts.preserveRecent);
        const oldMessages = nonSystemMessages.slice(0, -opts.preserveRecent);

        if (oldMessages.length === 0) {
            return {
                messages,
                originalCount,
                condensedCount: messages.length,
                tokensSaved: 0
            };
        }

        const summary = await this.summarizeMessages(oldMessages, opts.summaryPrompt!);
        const summaryMessage: Message = {
            role: 'system',
            content: `[Previous conversation summary]\n${summary}`,
            timestamp: Date.now()
        };

        const condensedMessages = [
            ...systemMessages,
            summaryMessage,
            ...recentMessages
        ];

        const originalTokens = this.estimateTokens(messages);
        const condensedTokens = this.estimateTokens(condensedMessages);

        return {
            messages: condensedMessages,
            summary,
            originalCount,
            condensedCount: condensedMessages.length,
            tokensSaved: originalTokens - condensedTokens
        };
    }

    private async summarizeMessages(messages: Message[], prompt: string): Promise<string> {
        if (!this.provider) {
            return this.fallbackSummarize(messages);
        }

        const conversationText = messages.map(m => 
            `${m.role.toUpperCase()}: ${m.content}`
        ).join('\n\n');

        try {
            const response = await this.provider.complete({
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: conversationText }
                ],
                maxTokens: 1000,
                temperature: 0.3
            });
            return response.content;
        } catch {
            return this.fallbackSummarize(messages);
        }
    }

    private fallbackSummarize(messages: Message[]): string {
        const keyPoints: string[] = [];
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                const firstLine = msg.content.split('\n')[0].slice(0, 100);
                if (firstLine.includes('?') || firstLine.toLowerCase().includes('please')) {
                    keyPoints.push(`User asked: ${firstLine}`);
                }
            } else if (msg.role === 'assistant') {
                if (msg.content.includes('```')) {
                    keyPoints.push('Assistant provided code');
                }
                if (msg.content.includes('created') || msg.content.includes('modified')) {
                    const match = msg.content.match(/(created|modified|updated|deleted)\s+[\w./]+/i);
                    if (match) {
                        keyPoints.push(`Assistant ${match[0]}`);
                    }
                }
            }
        }

        return keyPoints.length > 0 
            ? keyPoints.slice(0, 10).join('\n')
            : `Conversation with ${messages.length} messages`;
    }

    private estimateTokens(messages: Message[]): number {
        let total = 0;
        for (const msg of messages) {
            total += Math.ceil(msg.content.length / 4);
        }
        return total;
    }

    async shouldCondense(messages: Message[], maxTokens: number): Promise<boolean> {
        const currentTokens = this.estimateTokens(messages);
        return currentTokens > maxTokens * 0.8;
    }

    extractKeyInfo(messages: Message[]): { files: string[]; commands: string[]; decisions: string[] } {
        const files: Set<string> = new Set();
        const commands: Set<string> = new Set();
        const decisions: string[] = [];

        const filePattern = /[\w./]+\.(ts|js|py|json|md|yaml|yml|sh|css|html)/g;
        const commandPattern = /`([^`]+)`/g;

        for (const msg of messages) {
            const fileMatches = msg.content.match(filePattern);
            if (fileMatches) {
                fileMatches.forEach(f => files.add(f));
            }

            if (msg.role === 'assistant') {
                const cmdMatches = msg.content.match(commandPattern);
                if (cmdMatches) {
                    cmdMatches.forEach(c => {
                        const cmd = c.replace(/`/g, '');
                        if (cmd.startsWith('npm') || cmd.startsWith('git') || cmd.startsWith('cd')) {
                            commands.add(cmd);
                        }
                    });
                }
            }

            if (msg.content.toLowerCase().includes('decided') || 
                msg.content.toLowerCase().includes('will use') ||
                msg.content.toLowerCase().includes('approach')) {
                const sentences = msg.content.split(/[.!?]/);
                for (const s of sentences) {
                    if (s.toLowerCase().includes('decided') || 
                        s.toLowerCase().includes('will use') ||
                        s.toLowerCase().includes('approach')) {
                        decisions.push(s.trim());
                    }
                }
            }
        }

        return {
            files: Array.from(files),
            commands: Array.from(commands),
            decisions: decisions.slice(0, 5)
        };
    }
}
