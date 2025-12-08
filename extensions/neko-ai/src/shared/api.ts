export type ApiProvider = 
    | 'openai'
    | 'anthropic'
    | 'ollama'
    | 'openrouter'
    | 'azure'
    | 'gemini'
    | 'deepseek'
    | 'mistral'
    | 'groq'
    | 'xai'
    | 'bedrock'
    | 'cohere'
    | 'together'
    | 'moonshot'
    | 'qwen'
    | 'custom';

export interface ApiConfiguration {
    provider: ApiProvider;
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    completionModel?: string;
    embeddingModel?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    timeout?: number;
}

export interface ApiRequestMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ContentBlock[];
    name?: string;
    toolCallId?: string;
}

export interface ContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    source?: ImageSource;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    toolUseId?: string;
    content?: string;
}

export interface ImageSource {
    type: 'base64' | 'url';
    mediaType?: string;
    data?: string;
    url?: string;
}

export interface ApiRequest {
    messages: ApiRequestMessage[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
    tools?: ToolDefinition[];
    toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; name: string };
    stopSequences?: string[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, PropertySchema>;
        required?: string[];
    };
}

export interface PropertySchema {
    type: string;
    description?: string;
    enum?: string[];
    items?: PropertySchema;
    properties?: Record<string, PropertySchema>;
}

export interface ApiResponse {
    id: string;
    content: string;
    stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    usage: ApiUsage;
    toolCalls?: ToolCall[];
}

export interface ApiUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}

export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ApiStreamEvent {
    type: 'text' | 'tool_use' | 'usage' | 'error' | 'done';
    text?: string;
    toolCall?: ToolCall;
    usage?: ApiUsage;
    error?: string;
}

export type ApiStreamCallback = (event: ApiStreamEvent) => void;

export interface ApiError {
    code: string;
    message: string;
    status?: number;
    retryable?: boolean;
}

export function isApiError(error: unknown): error is ApiError {
    return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}
