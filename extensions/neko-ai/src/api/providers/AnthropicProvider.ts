import Anthropic from '@anthropic-ai/sdk';
import { 
    BaseProvider, 
    CompletionRequest, 
    CompletionResponse, 
    EmbeddingResponse,
    StreamCallback,
    ProviderOptions 
} from './BaseProvider';

export class AnthropicProvider extends BaseProvider {
    private client: Anthropic;

    constructor(options: ProviderOptions) {
        super(options);
        this.client = new Anthropic({
            apiKey: options.apiKey,
            baseURL: options.apiEndpoint || undefined
        });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const systemMessage = request.messages.find(m => m.role === 'system');
        const otherMessages = request.messages.filter(m => m.role !== 'system');
        const systemContent = systemMessage ? this.getStringContent(systemMessage.content) : this.buildSystemPrompt();
        const convertedMessages = this.convertMessagesToStrings(otherMessages);

        const response = await this.client.messages.create({
            model: this.options.model,
            max_tokens: request.maxTokens || 4096,
            system: systemContent,
            messages: convertedMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }))
        });

        const content = response.content[0];
        return {
            content: content.type === 'text' ? content.text : '',
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            }
        };
    }

    async completeStream(
        request: CompletionRequest, 
        callback: StreamCallback
    ): Promise<void> {
        const systemMessage = request.messages.find(m => m.role === 'system');
        const otherMessages = request.messages.filter(m => m.role !== 'system');
        const systemContent = systemMessage ? this.getStringContent(systemMessage.content) : this.buildSystemPrompt();
        const convertedMessages = this.convertMessagesToStrings(otherMessages);

        const stream = this.client.messages.stream({
            model: this.options.model,
            max_tokens: request.maxTokens || 4096,
            system: systemContent,
            messages: convertedMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }))
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if ('text' in delta) {
                    callback(delta.text);
                }
            }
        }
    }

    async getEmbedding(_text: string): Promise<EmbeddingResponse> {
        throw new Error('Anthropic does not support embeddings. Use OpenAI or another provider for embeddings.');
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

Output only the code that should be inserted:`;

        const response = await this.client.messages.create({
            model: this.options.completionModel,
            max_tokens: 256,
            system: 'You are a code completion assistant. Output only the code that should be inserted at the cursor position. No explanations or markdown.',
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0];
        return content.type === 'text' ? content.text.trim() : '';
    }
}
