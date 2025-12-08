declare module 'openai' {
    export interface ChatCompletionMessageParam {
        role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
        content: string | null | unknown[];
        name?: string;
        function_call?: { name: string; arguments: string };
        tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
        }>;
    }

    export interface ChatCompletionChunk {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: Array<{
            index: number;
            delta: {
                role?: string;
                content?: string;
            };
            finish_reason: string | null;
        }>;
    }

    export interface ChatCompletion {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: Array<{
            index: number;
            message: ChatCompletionMessageParam;
            finish_reason: string;
        }>;
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    }

    export interface CompletionCreateParams {
        model: string;
        messages: ChatCompletionMessageParam[];
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
        frequency_penalty?: number;
        presence_penalty?: number;
        stop?: string | string[];
        stream?: boolean;
    }

    export interface Stream<T> extends AsyncIterable<T> {
        controller: AbortController;
    }

    export interface Chat {
        completions: {
            create(params: CompletionCreateParams & { stream: true }): Promise<Stream<ChatCompletionChunk>>;
            create(params: CompletionCreateParams & { stream?: false }): Promise<ChatCompletion>;
            create(params: CompletionCreateParams): Promise<ChatCompletion | Stream<ChatCompletionChunk>>;
        };
    }

    export interface EmbeddingCreateParams {
        model: string;
        input: string | string[];
    }

    export interface Embedding {
        object: string;
        embedding: number[];
        index: number;
    }

    export interface EmbeddingResponse {
        object: string;
        data: Embedding[];
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
    }

    export interface Embeddings {
        create(params: EmbeddingCreateParams): Promise<EmbeddingResponse>;
    }

    export interface OpenAIOptions {
        apiKey: string;
        baseURL?: string;
        organization?: string;
        timeout?: number;
        maxRetries?: number;
    }

    export default class OpenAI {
        constructor(options: OpenAIOptions);
        chat: Chat;
        embeddings: Embeddings;
    }
}
