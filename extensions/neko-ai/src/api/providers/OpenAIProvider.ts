import OpenAI from 'openai';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';

export class OpenAIProvider extends BaseProvider {
    private client: OpenAI;

    constructor(options: ProviderOptions) {
        super(options);
        this.client = new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.apiEndpoint || undefined
        });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = this.convertMessagesToStrings(request.messages);
        const response = await this.client.chat.completions.create({
            model: this.options.model,
            messages: messages.map(m => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content
            })),
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature
        });

        const content = response.choices[0]?.message?.content;
        return {
            content: typeof content === 'string' ? content : '',
            usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            } : undefined
        };
    }

    async completeStream(
        request: CompletionRequest, 
        callback: StreamCallback
    ): Promise<void> {
        const messages = this.convertMessagesToStrings(request.messages);
        const stream = await this.client.chat.completions.create({
            model: this.options.model,
            messages: messages.map(m => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content
            })),
            max_tokens: request.maxTokens,
            temperature: request.temperature ?? this.options.temperature,
            stream: true
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                callback(content);
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await this.client.embeddings.create({
            model: this.options.embeddingModel,
            input: text
        });

        return {
            embedding: response.data[0].embedding
        };
    }

    async inlineComplete(
        prefix: string, 
        suffix: string, 
        language: string
    ): Promise<string> {
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

        const response = await this.client.chat.completions.create({
            model: this.options.completionModel,
            messages: [
                { role: 'system', content: 'You are a code completion assistant. Output only the code that should be inserted at the cursor position. No explanations or markdown.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 256,
            temperature: 0.2
        });

        const content = response.choices[0]?.message?.content;
        return typeof content === 'string' ? content.trim() : '';
    }
}
