import axios from 'axios';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';
import { GeminiCompletionResponse, GeminiEmbeddingResponse } from '../../types/api-responses';

export class GeminiProvider extends BaseProvider {
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(options: ProviderOptions) {
        super(options);
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const contents = convertedMessages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const systemInstruction = convertedMessages.find(m => m.role === 'system');

        const response = await axios.post<GeminiCompletionResponse>(
            `${this.baseUrl}/models/${this.options.model}:generateContent?key=${this.options.apiKey}`,
            {
                contents,
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction.content }] } : undefined,
                generationConfig: {
                    temperature: request.temperature ?? this.options.temperature,
                    maxOutputTokens: request.maxTokens
                }
            }
        );

        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
            content: text,
            usage: response.data.usageMetadata ? {
                promptTokens: response.data.usageMetadata.promptTokenCount || 0,
                completionTokens: response.data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: response.data.usageMetadata.totalTokenCount || 0
            } : undefined
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const convertedMessages = this.convertMessagesToStrings(request.messages);
        const contents = convertedMessages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const response = await axios.post<NodeJS.ReadableStream>(
            `${this.baseUrl}/models/${this.options.model}:streamGenerateContent?key=${this.options.apiKey}&alt=sse`,
            { contents },
            { responseType: 'stream' }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.startsWith('data: '));
            for (const line of lines) {
                try {
                    const data = JSON.parse(line.slice(6));
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) callback(text);
                } catch { /* skip */ }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await axios.post<GeminiEmbeddingResponse>(
            `${this.baseUrl}/models/${this.options.embeddingModel || 'text-embedding-004'}:embedContent?key=${this.options.apiKey}`,
            { content: { parts: [{ text }] } }
        );
        return { embedding: response.data.embedding.values };
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
