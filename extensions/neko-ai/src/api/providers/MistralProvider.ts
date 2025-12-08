import axios from 'axios';
import {
    BaseProvider,
    ProviderOptions,
    CompletionRequest,
    CompletionResponse,
    EmbeddingResponse,
    StreamCallback
} from './BaseProvider';

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
        };
        delta?: {
            content?: string;
        };
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface EmbeddingApiResponse {
    data: Array<{
        embedding: number[];
    }>;
}

interface FimCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
}

export class MistralProvider extends BaseProvider {
    private baseUrl: string;

    constructor(options: ProviderOptions) {
        super({
            ...options,
            model: options.model || 'mistral-large-latest',
            completionModel: options.completionModel || 'codestral-latest',
            embeddingModel: options.embeddingModel || 'mistral-embed'
        });
        this.baseUrl = options.apiEndpoint || 'https://api.mistral.ai/v1';
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = this.convertMessagesToStrings(request.messages);

        const response = await axios.post<ChatCompletionResponse>(
            `${this.baseUrl}/chat/completions`,
            {
                model: this.options.model,
                messages,
                max_tokens: request.maxTokens || 4096,
                temperature: request.temperature ?? this.options.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            content: response.data.choices[0].message.content,
            usage: {
                promptTokens: response.data.usage?.prompt_tokens || 0,
                completionTokens: response.data.usage?.completion_tokens || 0,
                totalTokens: response.data.usage?.total_tokens || 0
            }
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const messages = this.convertMessagesToStrings(request.messages);

        const response = await axios.post<NodeJS.ReadableStream>(
            `${this.baseUrl}/chat/completions`,
            {
                model: this.options.model,
                messages,
                max_tokens: request.maxTokens || 4096,
                temperature: request.temperature ?? this.options.temperature,
                stream: true
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            }
        );

        const stream = response.data;
        let buffer = '';

        for await (const chunk of stream) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            callback(content);
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<EmbeddingApiResponse>(
            `${this.baseUrl}/embeddings`,
            {
                model: this.options.embeddingModel,
                input: text
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            embedding: response.data.data[0].embedding
        };
    }

    async inlineComplete(prefix: string, suffix: string, _language: string): Promise<string> {
        const response = await axios.post<FimCompletionResponse>(
            `${this.baseUrl}/fim/completions`,
            {
                model: this.options.completionModel,
                prompt: prefix,
                suffix: suffix,
                max_tokens: 256,
                temperature: 0.2
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices?.[0]?.message?.content || '';
    }
}
