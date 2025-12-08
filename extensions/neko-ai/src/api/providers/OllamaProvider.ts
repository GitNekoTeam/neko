import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { OllamaCompletionResponse, OllamaEmbeddingResponse } from '../../types/api-responses';

interface OllamaGenerateResponse {
    response: string;
}

export class OllamaProvider extends BaseProvider {
    private baseUrl: string;

    constructor(options: ProviderOptions) {
        super(options);
        this.baseUrl = options.apiEndpoint || 'http://localhost:11434';
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<OllamaCompletionResponse>(`${this.baseUrl}/api/chat`, {
            model: this.options.model,
            messages: convertedMessages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: false,
            options: {
                temperature: request.temperature ?? this.options.temperature
            }
        });

        return {
            content: response.data.message?.content || '',
            usage: response.data.eval_count ? {
                promptTokens: response.data.prompt_eval_count || 0,
                completionTokens: response.data.eval_count || 0,
                totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
            } : undefined
        };
    }

    async completeStream(
        request: CompletionRequest, 
        callback: StreamCallback
    ): Promise<void> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<NodeJS.ReadableStream>(`${this.baseUrl}/api/chat`, {
            model: this.options.model,
            messages: convertedMessages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: true,
            options: {
                temperature: request.temperature ?? this.options.temperature
            }
        }, {
            responseType: 'stream'
        });

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        callback(data.message.content);
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<OllamaEmbeddingResponse>(`${this.baseUrl}/api/embeddings`, {
            model: this.options.embeddingModel || 'nomic-embed-text',
            prompt: text
        });

        return {
            embedding: response.data.embedding
        };
    }

    async inlineComplete(
        prefix: string, 
        suffix: string, 
        language: string
    ): Promise<string> {
        const prompt = `Complete the following ${language} code. Only output the completion, no explanation.

Code before cursor:
${prefix}

Code after cursor:
${suffix}

Completion:`;

        const response = await axios.post<OllamaGenerateResponse>(`${this.baseUrl}/api/generate`, {
            model: this.options.completionModel,
            prompt,
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 256
            }
        });

        return response.data.response?.trim() || '';
    }
}
