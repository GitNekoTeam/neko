import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { OpenAICompletionResponse, OpenAIEmbeddingResponse } from '../../types/api-responses';

export class AzureProvider extends BaseProvider {
    constructor(options: ProviderOptions) {
        super(options);
    }

    private get endpoint(): string {
        return this.options.apiEndpoint;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await axios.post<OpenAICompletionResponse>(
            `${this.endpoint}/openai/deployments/${this.options.model}/chat/completions?api-version=2024-02-15-preview`,
            {
                messages: request.messages,
                max_tokens: request.maxTokens,
                temperature: request.temperature ?? this.options.temperature
            },
            { headers: { 'api-key': this.options.apiKey } }
        );

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
        const response = await axios.post<NodeJS.ReadableStream>(
            `${this.endpoint}/openai/deployments/${this.options.model}/chat/completions?api-version=2024-02-15-preview`,
            {
                messages: request.messages,
                max_tokens: request.maxTokens,
                temperature: request.temperature ?? this.options.temperature,
                stream: true
            },
            { headers: { 'api-key': this.options.apiKey }, responseType: 'stream' }
        );

        const stream = response.data as unknown as AsyncIterable<Buffer>;
        for await (const chunk of stream) {
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

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<OpenAIEmbeddingResponse>(
            `${this.endpoint}/openai/deployments/${this.options.embeddingModel}/embeddings?api-version=2024-02-15-preview`,
            { input: text },
            { headers: { 'api-key': this.options.apiKey } }
        );
        return { embedding: response.data.data[0].embedding };
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
