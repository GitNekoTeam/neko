import {
    BaseProvider,
    ProviderOptions,
    CompletionRequest,
    CompletionResponse,
    EmbeddingResponse,
    StreamCallback
} from './BaseProvider';

interface BedrockOptions extends ProviderOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

interface BedrockChatResponse {
    content?: Array<{
        text?: string;
    }>;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface BedrockEmbeddingResponse {
    embedding?: number[];
}

export class BedrockProvider extends BaseProvider {
    private region: string;

    constructor(options: BedrockOptions) {
        super({
            ...options,
            model: options.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            completionModel: options.completionModel || 'anthropic.claude-3-haiku-20240307-v1:0',
            embeddingModel: options.embeddingModel || 'amazon.titan-embed-text-v2:0'
        });
        this.region = options.region || 'us-east-1';
    }

    private getEndpoint(): string {
        return `https://bedrock-runtime.${this.region}.amazonaws.com`;
    }

    private async signRequest(_method: string, _path: string, _body: string): Promise<Record<string, string>> {
        const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Amz-Date': date,
            'Host': `bedrock-runtime.${this.region}.amazonaws.com`
        };

        return headers;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = this.convertMessagesToStrings(request.messages);
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: request.maxTokens || 4096,
            system: systemMessage?.content || this.buildSystemPrompt(),
            messages: chatMessages.map(m => ({
                role: m.role,
                content: m.content
            })),
            temperature: request.temperature ?? this.options.temperature
        });

        const path = `/model/${this.options.model}/invoke`;
        const headers = await this.signRequest('POST', path, body);

        const response = await fetch(`${this.getEndpoint()}${path}`, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as BedrockChatResponse;

        return {
            content: data.content?.[0]?.text || '',
            usage: {
                promptTokens: data.usage?.input_tokens || 0,
                completionTokens: data.usage?.output_tokens || 0,
                totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
            }
        };
    }

    async completeStream(request: CompletionRequest, callback: StreamCallback): Promise<void> {
        const messages = this.convertMessagesToStrings(request.messages);
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: request.maxTokens || 4096,
            system: systemMessage?.content || this.buildSystemPrompt(),
            messages: chatMessages.map(m => ({
                role: m.role,
                content: m.content
            })),
            temperature: request.temperature ?? this.options.temperature
        });

        const path = `/model/${this.options.model}/invoke-with-response-stream`;
        const headers = await this.signRequest('POST', path, body);

        const response = await fetch(`${this.getEndpoint()}${path}`, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        let reading = true;
        while (reading) {
            const { done, value } = await reader.read();
            if (done) {
                reading = false;
                continue;
            }

            buffer += decoder.decode(value, { stream: true });
            
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
                if (event.includes('"type":"content_block_delta"')) {
                    try {
                        const match = event.match(/\{.*\}/);
                        if (match) {
                            const data = JSON.parse(match[0]);
                            if (data.delta?.text) {
                                callback(data.delta.text);
                            }
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async getEmbedding(text: string): Promise<EmbeddingResponse> {
        const body = JSON.stringify({
            inputText: text
        });

        const path = `/model/${this.options.embeddingModel}/invoke`;
        const headers = await this.signRequest('POST', path, body);

        const response = await fetch(`${this.getEndpoint()}${path}`, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as BedrockEmbeddingResponse;

        return {
            embedding: data.embedding || []
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
