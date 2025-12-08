import * as vscode from 'vscode';
import { BaseProvider, Message } from '../../api/providers/BaseProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ContextBuilder } from '../../services/context/ContextBuilder';
import { CodeIndexManager } from '../../services/code-index/CodeIndexManager';

export interface AgentMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolName?: string;
    toolResult?: string;
}

export interface AgentConfig {
    maxIterations: number;
    autoApprove: boolean;
    streamResponse: boolean;
}

export class Agent {
    private outputChannel: vscode.OutputChannel;
    private provider: BaseProvider;
    private toolRegistry: ToolRegistry;
    private contextBuilder: ContextBuilder;
    private messages: AgentMessage[] = [];
    private config: AgentConfig;
    private isRunning = false;

    constructor(
        outputChannel: vscode.OutputChannel,
        provider: BaseProvider,
        toolRegistry: ToolRegistry,
        codeIndexManager: CodeIndexManager,
        config?: Partial<AgentConfig>
    ) {
        this.outputChannel = outputChannel;
        this.provider = provider;
        this.toolRegistry = toolRegistry;
        this.contextBuilder = new ContextBuilder(outputChannel, codeIndexManager);
        this.config = {
            maxIterations: 10,
            autoApprove: false,
            streamResponse: true,
            ...config
        };
    }

    async run(
        userMessage: string,
        onUpdate?: (content: string) => void
    ): Promise<string> {
        if (this.isRunning) {
            throw new Error('Agent is already running');
        }

        this.isRunning = true;
        let iterations = 0;

        try {
            await this.contextBuilder.addCurrentFile();
            await this.contextBuilder.addSelection();
            await this.contextBuilder.addRelevantFiles(userMessage, 3);

            const context = await this.contextBuilder.build();
            const systemPrompt = this.buildSystemPrompt(context);

            this.messages.push({ role: 'system', content: systemPrompt });
            this.messages.push({ role: 'user', content: userMessage });

            while (iterations < this.config.maxIterations) {
                iterations++;
                this.outputChannel.appendLine(`Agent iteration ${iterations}`);

                const response = await this.getCompletion(onUpdate);
                this.messages.push({ role: 'assistant', content: response });

                const toolCalls = this.parseToolCalls(response);

                if (toolCalls.length === 0) {
                    return response;
                }

                for (const toolCall of toolCalls) {
                    if (!this.config.autoApprove) {
                        const approved = await this.requestApproval(toolCall);
                        if (!approved) {
                            this.messages.push({
                                role: 'tool',
                                content: 'Tool execution was cancelled by user',
                                toolName: toolCall.name
                            });
                            continue;
                        }
                    }

                    const result = await this.toolRegistry.execute(
                        toolCall.name,
                        toolCall.arguments
                    );

                    this.messages.push({
                        role: 'tool',
                        content: result.success ? result.output : `Error: ${result.error}`,
                        toolName: toolCall.name,
                        toolResult: result.output
                    });

                    onUpdate?.(`\n\n[Tool: ${toolCall.name}]\n${result.output}\n`);
                }
            }

            return this.messages[this.messages.length - 1].content;
        } finally {
            this.isRunning = false;
            this.contextBuilder.clear();
        }
    }

    private async getCompletion(onUpdate?: (content: string) => void): Promise<string> {
        const apiMessages: Message[] = this.messages.map(m => ({
            role: m.role === 'tool' ? 'user' : m.role,
            content: m.role === 'tool' 
                ? `[Tool Result: ${m.toolName}]\n${m.content}`
                : m.content
        }));

        if (this.config.streamResponse && onUpdate) {
            let fullContent = '';
            await this.provider.completeStream(
                { messages: apiMessages, maxTokens: 4096 },
                (chunk) => {
                    fullContent += chunk;
                    onUpdate(chunk);
                }
            );
            return fullContent;
        } else {
            const response = await this.provider.complete({
                messages: apiMessages,
                maxTokens: 4096
            });
            onUpdate?.(response.content);
            return response.content;
        }
    }

    private buildSystemPrompt(context: string): string {
        const toolsPrompt = this.toolRegistry.getToolsPrompt();

        return `You are Neko AI, an intelligent coding assistant. You help developers write, understand, debug, and improve code.

${toolsPrompt}

Guidelines:
- Analyze the user's request carefully before responding
- Use tools when needed to read files, write code, search the codebase, or execute commands
- Always explain what you're doing and why
- Be concise but thorough
- If you're unsure, ask for clarification
- After making changes, verify they work correctly

${context ? `\nContext:\n${context}` : ''}`;
    }

    private parseToolCalls(response: string): Array<{ name: string; arguments: Record<string, unknown> }> {
        const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
        const toolRegex = /<tool\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/tool>/g;

        let match;
        while ((match = toolRegex.exec(response)) !== null) {
            const name = match[1];
            const argsStr = match[2].trim();

            try {
                const args = JSON.parse(argsStr);
                toolCalls.push({ name, arguments: args });
            } catch {
                this.outputChannel.appendLine(`Failed to parse tool arguments: ${argsStr}`);
            }
        }

        return toolCalls;
    }

    private async requestApproval(toolCall: { name: string; arguments: Record<string, unknown> }): Promise<boolean> {
        const result = await vscode.window.showInformationMessage(
            `Neko AI wants to use tool: ${toolCall.name}`,
            { modal: true, detail: JSON.stringify(toolCall.arguments, null, 2) },
            'Allow',
            'Deny'
        );
        return result === 'Allow';
    }

    stop(): void {
        this.isRunning = false;
    }

    clearHistory(): void {
        this.messages = [];
    }

    getMessages(): AgentMessage[] {
        return [...this.messages];
    }
}
