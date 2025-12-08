export interface ProviderOptions {
    apiKey: string;
    apiEndpoint: string;
    model: string;
    completionModel: string;
    embeddingModel: string;
    temperature: number;
    supportsVision?: boolean;
}

export interface ImageContent {
    type: 'image';
    source: {
        type: 'base64' | 'url';
        mediaType?: string;
        data?: string;
        url?: string;
    };
}

export interface TextContent {
    type: 'text';
    text: string;
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: MessageContent;
}

export interface CompletionRequest {
    messages: Message[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface CompletionResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface EmbeddingResponse {
    embedding: number[];
}

export interface StreamCallback {
    (chunk: string): void;
}

export abstract class BaseProvider {
    protected options: ProviderOptions;

    constructor(options: ProviderOptions) {
        this.options = options;
    }

    abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
    
    abstract completeStream(
        request: CompletionRequest, 
        callback: StreamCallback
    ): Promise<void>;
    
    abstract getEmbedding(text: string): Promise<EmbeddingResponse>;
    
    abstract inlineComplete(
        prefix: string, 
        suffix: string, 
        language: string
    ): Promise<string>;

    get model(): string {
        return this.options.model;
    }

    get completionModel(): string {
        return this.options.completionModel;
    }

    get embeddingModel(): string {
        return this.options.embeddingModel;
    }

    get supportsVision(): boolean {
        return this.options.supportsVision ?? false;
    }

    createImageContent(base64Data: string, mediaType = 'image/png'): ImageContent {
        return {
            type: 'image',
            source: {
                type: 'base64',
                mediaType,
                data: base64Data
            }
        };
    }

    createImageUrlContent(url: string): ImageContent {
        return {
            type: 'image',
            source: {
                type: 'url',
                url
            }
        };
    }

    createTextContent(text: string): TextContent {
        return {
            type: 'text',
            text
        };
    }

    createMessageWithImage(text: string, imageBase64: string, mediaType = 'image/png'): Message {
        return {
            role: 'user',
            content: [
                this.createTextContent(text),
                this.createImageContent(imageBase64, mediaType)
            ]
        };
    }

    protected buildSystemPrompt(): string {
        return 'You are Neko AI, an intelligent coding assistant. You help developers write, understand, and improve code. You provide clear, concise, and accurate responses. When writing code, follow best practices and include helpful comments.';
    }

    protected getStringContent(content: MessageContent): string {
        if (typeof content === 'string') {
            return content;
        }
        return content
            .filter((c): c is TextContent => c.type === 'text')
            .map(c => c.text)
            .join('\n');
    }

    protected convertMessagesToStrings(messages: Message[]): { role: string; content: string }[] {
        return messages.map(m => ({
            role: m.role,
            content: this.getStringContent(m.content)
        }));
    }
}
