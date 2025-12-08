export interface ParsedToolCall {
    name: string;
    params: Record<string, unknown>;
    raw: string;
    startIndex: number;
    endIndex: number;
}

export interface ParsedTextBlock {
    type: 'text';
    content: string;
    startIndex: number;
    endIndex: number;
}

export interface ParsedToolBlock {
    type: 'tool';
    toolCall: ParsedToolCall;
    startIndex: number;
    endIndex: number;
}

export interface ParsedThinkingBlock {
    type: 'thinking';
    content: string;
    startIndex: number;
    endIndex: number;
}

export interface ParsedCodeBlock {
    type: 'code';
    language: string;
    content: string;
    startIndex: number;
    endIndex: number;
}

export type ParsedBlock = ParsedTextBlock | ParsedToolBlock | ParsedThinkingBlock | ParsedCodeBlock;

export interface ParseResult {
    blocks: ParsedBlock[];
    toolCalls: ParsedToolCall[];
    hasPartialTool: boolean;
    partialToolContent?: string;
}

export interface ParserOptions {
    allowPartialParsing: boolean;
    toolTagName: string;
    thinkingTagName: string;
}
