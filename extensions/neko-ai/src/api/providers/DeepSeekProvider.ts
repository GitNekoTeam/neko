import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { DeepSeekCompletionResponse } from '../../types/api-responses';

export class DeepSeekProvider extends BaseProvider {
    private baseUrl = 'https://api.deepseek.com/v1';

    constructor(options: ProviderOptions) {
        super(options);
        if (options.apiEndpoint) {
            this.baseUrl = options.apiEndpoint;
        }
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await axios.post<DeepSeekCompletionResponse>(`${this.baseUrl}/chat/completions`, {
            model: this.options.model || 'deepseek-chat',
            messages: request.messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature
        }, {
            headers: { 'Authorization': `Bearer ${this.options.apiKey}` }
        });

        return {
            content: response.data.choices[0]?.message?.content || '',
            usage: response.data.usage ? {
                promptTokens: response.data.usage.prompt_tokens,
                completionTokens: response.data.usage.completion_tokens,
                totalTokens: response.data.usage.total_tokens
            } : undefined
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const response = await axios.post<NodeJS.ReadableStream>(`${this.baseUrl}/chat/completions`, {
            model: this.options.model || 'deepseek-chat',
            messages: request.messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature,
            stream: true
        }, {
            headers: { 'Authorization': `Bearer ${this.options.apiKey}` },
            responseType: 'stream'
        });

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content;
                    if (content) callback(content);
                } catch { /* skip */ }
            }
        }
    }

    async getEmbedding(_text: string): Promise<EmbeddingResponse> {
        throw new Error('DeepSeek does not support embeddings. Use OpenAI provider for embeddings.');
    }

    async inlineComplete(prefix: string, suffix: string, _language: string): Promise<string> {
        const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
        const response = await axios.post<DeepSeekCompletionResponse>(`${this.baseUrl}/completions`, {
            model: this.options.completionModel || 'deepseek-coder',
            prompt,
            max_tokens: 256,
            temperature: 0.2
        }, {
            headers: { 'Authorization': `Bearer ${this.options.apiKey}` }
        });
        return response.data.choices[0]?.text?.trim() || '';
    }
}
