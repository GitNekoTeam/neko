export type ApiStream = AsyncGenerator<ApiStreamChunk>;

export type ApiStreamChunk =
    | ApiStreamTextChunk
    | ApiStreamUsageChunk
    | ApiStreamReasoningChunk
    | ApiStreamToolCallChunk
    | ApiStreamToolCallStartChunk
    | ApiStreamToolCallDeltaChunk
    | ApiStreamToolCallEndChunk
    | ApiStreamToolCallPartialChunk
    | ApiStreamGroundingChunk
    | ApiStreamThinkingChunk
    | ApiStreamError;

export interface ApiStreamError {
    type: 'error';
    error: string;
    message: string;
}

export interface ApiStreamTextChunk {
    type: 'text';
    text: string;
}

export interface ApiStreamReasoningChunk {
    type: 'reasoning';
    text: string;
}

export interface ApiStreamThinkingChunk {
    type: 'thinking';
    thinking: string;
    signature?: string;
}

export interface ApiStreamUsageChunk {
    type: 'usage';
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
    reasoningTokens?: number;
    totalCost?: number;
}

export interface ApiStreamGroundingChunk {
    type: 'grounding';
    sources: GroundingSource[];
}

export interface ApiStreamToolCallChunk {
    type: 'tool_call';
    id: string;
    name: string;
    arguments: string;
}

export interface ApiStreamToolCallStartChunk {
    type: 'tool_call_start';
    id: string;
    name: string;
}

export interface ApiStreamToolCallDeltaChunk {
    type: 'tool_call_delta';
    id: string;
    delta: string;
}

export interface ApiStreamToolCallEndChunk {
    type: 'tool_call_end';
    id: string;
}

export interface ApiStreamToolCallPartialChunk {
    type: 'tool_call_partial';
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
}

export interface GroundingSource {
    title: string;
    url: string;
    snippet?: string;
}

export async function* createTextStream(text: string): ApiStream {
    yield { type: 'text', text };
}

export async function* createErrorStream(error: string, message: string): ApiStream {
    yield { type: 'error', error, message };
}

export async function collectStreamText(stream: ApiStream): Promise<string> {
    let text = '';
    for await (const chunk of stream) {
        if (chunk.type === 'text') {
            text += chunk.text;
        }
    }
    return text;
}

export async function collectStreamChunks(stream: ApiStream): Promise<ApiStreamChunk[]> {
    const chunks: ApiStreamChunk[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return chunks;
}
