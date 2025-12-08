import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { OpenRouterCompletionResponse } from '../../types/api-responses';

export class OpenRouterProvider extends BaseProvider {
    private baseUrl = 'https://openrouter.ai/api/v1';

    constructor(options: ProviderOptions) {
        super(options);
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<OpenRouterCompletionResponse>(`${this.baseUrl}/chat/completions`, {
            model: this.options.model,
            messages: convertedMessages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature
        }, {
            headers: {
                'Authorization': `Bearer ${this.options.apiKey}`,
                'HTTP-Referer': 'https://gitneko.com',
                'X-Title': 'Neko AI'
            }
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
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const response = await axios.post<NodeJS.ReadableStream>(`${this.baseUrl}/chat/completions`, {
            model: this.options.model,
            messages: convertedMessages,
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature,
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${this.options.apiKey}`,
                'HTTP-Referer': 'https://gitneko.com',
                'X-Title': 'Neko AI'
            },
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
        throw new Error('OpenRouter does not support embeddings directly. Use OpenAI provider for embeddings.');
    }

    async inlineComplete(prefix: string, suffix: string, language: string): Promise<string> {
        const prompt = `Complete the ${language} code. Output only the completion:\n\nBefore:\n${prefix}\n\nAfter:\n${suffix}`;
        const response = await this.complete({
            messages: [
                { role: 'system', content: 'Output only code, no explanations.' },
                { role: 'user', content: prompt }
            ],
            maxTokens: 256,
            temperature: 0.2
        });
        return response.content.trim();
    }
}
