import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { CustomCompletionResponse, CustomEmbeddingResponse } from '../../types/api-responses';

export class CustomProvider extends BaseProvider {
    constructor(options: ProviderOptions) {
        super(options);
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<CustomCompletionResponse>(`${this.options.apiEndpoint}/chat/completions`, {
            model: this.options.model,
            messages: convertedMessages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature
        }, {
            headers: this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {}
        });

        return {
            content: response.data.choices?.[0]?.message?.content || response.data.content || '',
            usage: response.data.usage ? {
                promptTokens: response.data.usage.prompt_tokens || 0,
                completionTokens: response.data.usage.completion_tokens || 0,
                totalTokens: response.data.usage.total_tokens || 0
            } : undefined
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<NodeJS.ReadableStream>(`${this.options.apiEndpoint}/chat/completions`, {
            model: this.options.model,
            messages: convertedMessages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature,
            stream: true
        }, {
            headers: this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {},
            responseType: 'stream'
        });

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || parsed.content;
                    if (content) callback(content);
                } catch { /* skip */ }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<CustomEmbeddingResponse>(`${this.options.apiEndpoint}/embeddings`, {
            model: this.options.embeddingModel,
            input: text
        }, {
            headers: this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {}
        });

        return { embedding: response.data.data?.[0]?.embedding || response.data.embedding || [] };
    }

    async inlineComplete(prefix: string, suffix: string, language: string): Promise<string> {
        const prompt = `Complete the ${language} code:\n\nBefore:\n${prefix}\n\nAfter:\n${suffix}`;
        const response = await this.complete({
            messages: [
                { role: 'system', content: 'Output only code.' },
                { role: 'user', content: prompt }
            ],
            maxTokens: 256,
            temperature: 0.2
        });
        return response.content.trim();
    }
}
