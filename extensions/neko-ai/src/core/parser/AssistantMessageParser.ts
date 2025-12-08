import {
    ParsedBlock,
    ParsedToolCall,
    ParsedTextBlock,
    ParsedToolBlock,
    ParsedThinkingBlock,
    ParsedCodeBlock,
    ParseResult,
    ParserOptions
} from './types';

const DEFAULT_OPTIONS: ParserOptions = {
    allowPartialParsing: true,
    toolTagName: 'tool',
    thinkingTagName: 'thinking'
};

export class AssistantMessageParser {
    private options: ParserOptions;

    constructor(options: Partial<ParserOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    public parse(content: string): ParseResult {
        const blocks: ParsedBlock[] = [];
        const toolCalls: ParsedToolCall[] = [];
        let hasPartialTool = false;
        let partialToolContent: string | undefined;

        let currentIndex = 0;
        const contentLength = content.length;

        while (currentIndex < contentLength) {
            const thinkingMatch = this.findThinkingBlock(content, currentIndex);
            const toolMatch = this.findToolBlock(content, currentIndex);
            const codeMatch = this.findCodeBlock(content, currentIndex);

            const nextMatch = this.getEarliestMatch([thinkingMatch, toolMatch, codeMatch]);

            if (!nextMatch || nextMatch.startIndex > currentIndex) {
                const textEnd = nextMatch ? nextMatch.startIndex : contentLength;
                const textContent = content.slice(currentIndex, textEnd);
                
                if (textContent.trim()) {
                    blocks.push({
                        type: 'text',
                        content: textContent,
                        startIndex: currentIndex,
                        endIndex: textEnd
                    });
                }
                
                if (!nextMatch) break;
                currentIndex = nextMatch.startIndex;
            }

            if (nextMatch) {
                if (nextMatch.type === 'thinking') {
                    blocks.push(nextMatch as ParsedThinkingBlock);
                } else if (nextMatch.type === 'tool') {
                    const toolBlock = nextMatch as ParsedToolBlock;
                    blocks.push(toolBlock);
                    toolCalls.push(toolBlock.toolCall);
                } else if (nextMatch.type === 'code') {
                    blocks.push(nextMatch as ParsedCodeBlock);
                }
                currentIndex = nextMatch.endIndex;
            }
        }

        if (this.options.allowPartialParsing) {
            const partialResult = this.checkPartialTool(content);
            hasPartialTool = partialResult.hasPartial;
            partialToolContent = partialResult.content;
        }

        return {
            blocks,
            toolCalls,
            hasPartialTool,
            partialToolContent
        };
    }

    private findThinkingBlock(content: string, startFrom: number): ParsedThinkingBlock | null {
        const tagName = this.options.thinkingTagName;
        const openTag = `<${tagName}>`;
        const closeTag = `</${tagName}>`;

        const openIndex = content.indexOf(openTag, startFrom);
        if (openIndex === -1) return null;

        const closeIndex = content.indexOf(closeTag, openIndex + openTag.length);
        if (closeIndex === -1) return null;

        const thinkingContent = content.slice(openIndex + openTag.length, closeIndex);

        return {
            type: 'thinking',
            content: thinkingContent.trim(),
            startIndex: openIndex,
            endIndex: closeIndex + closeTag.length
        };
    }

    private findToolBlock(content: string, startFrom: number): ParsedToolBlock | null {
        const tagName = this.options.toolTagName;
        const openTagPattern = new RegExp(`<${tagName}\\s+name="([^"]+)"\\s*>`, 'g');
        openTagPattern.lastIndex = startFrom;

        const openMatch = openTagPattern.exec(content);
        if (!openMatch) return null;

        const toolName = openMatch[1];
        const openIndex = openMatch.index;
        const contentStart = openIndex + openMatch[0].length;

        const closeTag = `</${tagName}>`;
        const closeIndex = content.indexOf(closeTag, contentStart);
        if (closeIndex === -1) return null;

        const toolContent = content.slice(contentStart, closeIndex).trim();
        let params: Record<string, unknown> = {};

        try {
            if (toolContent) {
                params = JSON.parse(toolContent);
            }
        } catch {
            params = this.parseXmlParams(toolContent);
        }

        const toolCall: ParsedToolCall = {
            name: toolName,
            params,
            raw: content.slice(openIndex, closeIndex + closeTag.length),
            startIndex: openIndex,
            endIndex: closeIndex + closeTag.length
        };

        return {
            type: 'tool',
            toolCall,
            startIndex: openIndex,
            endIndex: closeIndex + closeTag.length
        };
    }

    private findCodeBlock(content: string, startFrom: number): ParsedCodeBlock | null {
        const codeBlockPattern = /```(\w*)\n([\s\S]*?)```/g;
        codeBlockPattern.lastIndex = startFrom;

        const match = codeBlockPattern.exec(content);
        if (!match) return null;

        return {
            type: 'code',
            language: match[1] || 'text',
            content: match[2],
            startIndex: match.index,
            endIndex: match.index + match[0].length
        };
    }

    private parseXmlParams(content: string): Record<string, unknown> {
        const params: Record<string, unknown> = {};
        const paramPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
        
        let match;
        while ((match = paramPattern.exec(content)) !== null) {
            const key = match[1];
            const value = match[2].trim();
            
            if (value === 'true') {
                params[key] = true;
            } else if (value === 'false') {
                params[key] = false;
            } else if (!isNaN(Number(value)) && value !== '') {
                params[key] = Number(value);
            } else {
                params[key] = value;
            }
        }

        return params;
    }

    private getEarliestMatch(matches: (ParsedBlock | null)[]): ParsedBlock | null {
        const validMatches = matches.filter((m): m is ParsedBlock => m !== null);
        if (validMatches.length === 0) return null;

        return validMatches.reduce((earliest, current) => 
            current.startIndex < earliest.startIndex ? current : earliest
        );
    }

    private checkPartialTool(content: string): { hasPartial: boolean; content?: string } {
        const tagName = this.options.toolTagName;
        const openTagPattern = new RegExp(`<${tagName}\\s+name="[^"]*"\\s*>(?!.*</${tagName}>)`, 's');
        
        const match = content.match(openTagPattern);
        if (match) {
            const startIndex = content.lastIndexOf(match[0]);
            return {
                hasPartial: true,
                content: content.slice(startIndex)
            };
        }

        return { hasPartial: false };
    }

    public extractToolCalls(content: string): ParsedToolCall[] {
        return this.parse(content).toolCalls;
    }

    public extractText(content: string): string {
        const result = this.parse(content);
        return result.blocks
            .filter((b): b is ParsedTextBlock => b.type === 'text')
            .map(b => b.content)
            .join('\n');
    }

    public hasToolCalls(content: string): boolean {
        return this.parse(content).toolCalls.length > 0;
    }
}

export function parseAssistantMessage(content: string, options?: Partial<ParserOptions>): ParseResult {
    const parser = new AssistantMessageParser(options);
    return parser.parse(content);
}

export function extractToolCalls(content: string): ParsedToolCall[] {
    const parser = new AssistantMessageParser();
    return parser.extractToolCalls(content);
}
