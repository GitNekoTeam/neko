import axios from 'axios';
import {
    BaseProvider,
    ProviderOptions,
    CompletionRequest,
    CompletionResponse,
    EmbeddingResponse,
    StreamCallback
} from './BaseProvider';

interface CohereChatResponse {
    text: string;
    meta?: {
        tokens?: {
            input_tokens: number;
            output_tokens: number;
        };
    };
}

interface CohereEmbeddingResponse {
    embeddings: number[][];
}

export class CohereProvider extends BaseProvider {
    private baseUrl: string;

    constructor(options: ProviderOptions) {
        super({
            ...options,
            model: options.model || 'command-r-plus',
            completionModel: options.completionModel || 'command-r',
            embeddingModel: options.embeddingModel || 'embed-english-v3.0'
        });
        this.baseUrl = options.apiEndpoint || 'https://api.cohere.ai/v1';
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = this.convertMessagesToStrings(request.messages);
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const response = await axios.post<CohereChatResponse>(
            `${this.baseUrl}/chat`,
            {
                model: this.options.model,
                message: chatMessages[chatMessages.length - 1]?.content || '',
                chat_history: chatMessages.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
                    message: m.content
                })),
                preamble: systemMessage?.content || this.buildSystemPrompt(),
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
            content: response.data.text,
            usage: {
                promptTokens: response.data.meta?.tokens?.input_tokens || 0,
                completionTokens: response.data.meta?.tokens?.output_tokens || 0,
                totalTokens: (response.data.meta?.tokens?.input_tokens || 0) + 
                            (response.data.meta?.tokens?.output_tokens || 0)
            }
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const messages = this.convertMessagesToStrings(request.messages);
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const response = await axios.post<NodeJS.ReadableStream>(
            `${this.baseUrl}/chat`,
            {
                model: this.options.model,
                message: chatMessages[chatMessages.length - 1]?.content || '',
                chat_history: chatMessages.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
                    message: m.content
                })),
                preamble: systemMessage?.content || this.buildSystemPrompt(),
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
                if (line.trim()) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.event_type === 'text-generation' && parsed.text) {
                            callback(parsed.text);
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<CohereEmbeddingResponse>(
            `${this.baseUrl}/embed`,
            {
                model: this.options.embeddingModel,
                texts: [text],
                input_type: 'search_document'
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            embedding: response.data.embeddings[0]
        };
    }

    async inlineComplete(prefix: string, suffix: string, language: string): Promise<string> {
        const prompt = `Complete the following ${language} code. Only output the completion, no explanation.

Code before cursor:
\`\`\`${language}
${prefix}
\`\`\`

Code after cursor:
\`\`\`${language}
${suffix}
\`\`\`

Completion:`;

        const response = await this.complete({
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 256,
            temperature: 0.2
        });

        return response.content.trim();
    }
}
