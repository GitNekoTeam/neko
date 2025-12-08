import { ParsedToolCall, ParseResult } from './types';
import { AssistantMessageParser } from './AssistantMessageParser';

export interface StreamChunk {
    type: 'text' | 'tool_start' | 'tool_params' | 'tool_end' | 'thinking' | 'code';
    content: string;
    toolName?: string;
    toolParams?: Record<string, unknown>;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class StreamingParser {
    private buffer = '';
    private parser: AssistantMessageParser;
    private processedIndex = 0;
    private currentToolName: string | null = null;
    private currentToolBuffer = '';
    private inTool = false;
    private callback: StreamCallback;

    constructor(callback: StreamCallback) {
        this.parser = new AssistantMessageParser({ allowPartialParsing: true });
        this.callback = callback;
    }

    public feed(chunk: string): void {
        this.buffer += chunk;
        this.processBuffer();
    }

    private processBuffer(): void {
        const content = this.buffer;

        if (this.inTool) {
            this.processToolContent(content);
            return;
        }

        const toolStartMatch = content.slice(this.processedIndex).match(/<tool\s+name="([^"]+)"\s*>/);
        
        if (toolStartMatch) {
            const matchIndex = this.processedIndex + (toolStartMatch.index ?? 0);
            
            if (matchIndex > this.processedIndex) {
                const textContent = content.slice(this.processedIndex, matchIndex);
                this.emitText(textContent);
            }

            this.currentToolName = toolStartMatch[1];
            this.inTool = true;
            this.currentToolBuffer = '';
            this.processedIndex = matchIndex + toolStartMatch[0].length;

            this.callback({
                type: 'tool_start',
                content: '',
                toolName: this.currentToolName
            });

            this.processToolContent(content);
            return;
        }

        const thinkingMatch = this.findCompleteTag(content, this.processedIndex, 'thinking');
        if (thinkingMatch) {
            if (thinkingMatch.startIndex > this.processedIndex) {
                this.emitText(content.slice(this.processedIndex, thinkingMatch.startIndex));
            }
            
            this.callback({
                type: 'thinking',
                content: thinkingMatch.content
            });
            
            this.processedIndex = thinkingMatch.endIndex;
            this.processBuffer();
            return;
        }

        const codeMatch = this.findCodeBlock(content, this.processedIndex);
        if (codeMatch) {
            if (codeMatch.startIndex > this.processedIndex) {
                this.emitText(content.slice(this.processedIndex, codeMatch.startIndex));
            }

            this.callback({
                type: 'code',
                content: codeMatch.content
            });

            this.processedIndex = codeMatch.endIndex;
            this.processBuffer();
            return;
        }

        const safeEnd = this.findSafeTextEnd(content, this.processedIndex);
        if (safeEnd > this.processedIndex) {
            this.emitText(content.slice(this.processedIndex, safeEnd));
            this.processedIndex = safeEnd;
        }
    }

    private processToolContent(content: string): void {
        const closeTagIndex = content.indexOf('</tool>', this.processedIndex);

        if (closeTagIndex !== -1) {
            this.currentToolBuffer += content.slice(this.processedIndex, closeTagIndex);
            
            let params: Record<string, unknown> = {};
            try {
                if (this.currentToolBuffer.trim()) {
                    params = JSON.parse(this.currentToolBuffer.trim());
                }
            } catch {
                params = this.parseXmlParams(this.currentToolBuffer);
            }

            this.callback({
                type: 'tool_end',
                content: this.currentToolBuffer,
                toolName: this.currentToolName ?? undefined,
                toolParams: params
            });

            this.processedIndex = closeTagIndex + '</tool>'.length;
            this.inTool = false;
            this.currentToolName = null;
            this.currentToolBuffer = '';

            this.processBuffer();
        } else {
            const newContent = content.slice(this.processedIndex);
            this.currentToolBuffer += newContent;
            this.processedIndex = content.length;

            this.callback({
                type: 'tool_params',
                content: newContent,
                toolName: this.currentToolName ?? undefined
            });
        }
    }

    private findCompleteTag(content: string, startFrom: number, tagName: string): { content: string; startIndex: number; endIndex: number } | null {
        const openTag = `<${tagName}>`;
        const closeTag = `</${tagName}>`;

        const openIndex = content.indexOf(openTag, startFrom);
        if (openIndex === -1) return null;

        const closeIndex = content.indexOf(closeTag, openIndex + openTag.length);
        if (closeIndex === -1) return null;

        return {
            content: content.slice(openIndex + openTag.length, closeIndex).trim(),
            startIndex: openIndex,
            endIndex: closeIndex + closeTag.length
        };
    }

    private findCodeBlock(content: string, startFrom: number): { content: string; startIndex: number; endIndex: number } | null {
        const pattern = /```(\w*)\n([\s\S]*?)```/g;
        pattern.lastIndex = startFrom;

        const match = pattern.exec(content);
        if (!match) return null;

        return {
            content: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
        };
    }

    private findSafeTextEnd(content: string, startFrom: number): number {
        const potentialTagStart = content.indexOf('<', startFrom);
        const potentialCodeStart = content.indexOf('```', startFrom);

        const markers = [potentialTagStart, potentialCodeStart].filter(i => i !== -1);
        
        if (markers.length === 0) {
            return content.length;
        }

        return Math.min(...markers);
    }

    private emitText(text: string): void {
        if (text.trim()) {
            this.callback({
                type: 'text',
                content: text
            });
        }
    }

    private parseXmlParams(content: string): Record<string, unknown> {
        const params: Record<string, unknown> = {};
        const paramPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
        
        let match;
        while ((match = paramPattern.exec(content)) !== null) {
            params[match[1]] = match[2].trim();
        }

        return params;
    }

    public getFullContent(): string {
        return this.buffer;
    }

    public getResult(): ParseResult {
        return this.parser.parse(this.buffer);
    }

    public getToolCalls(): ParsedToolCall[] {
        return this.parser.extractToolCalls(this.buffer);
    }

    public reset(): void {
        this.buffer = '';
        this.processedIndex = 0;
        this.currentToolName = null;
        this.currentToolBuffer = '';
        this.inTool = false;
    }
}
