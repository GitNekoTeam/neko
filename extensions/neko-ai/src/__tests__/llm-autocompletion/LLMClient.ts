import axios from 'axios';
import { LLMClientOptions, CompletionRequest, CompletionResponse } from './types';

export class LLMClient {
    private options: LLMClientOptions;

    constructor(options: LLMClientOptions) {
        this.options = options;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const { provider } = this.options;

        switch (provider) {
            case 'openai':
                return this.completeOpenAI(request);
            case 'anthropic':
                return this.completeAnthropic(request);
            case 'ollama':
                return this.completeOllama(request);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    private async completeOpenAI(request: CompletionRequest): Promise<CompletionResponse> {
        const { apiKey, apiEndpoint, model, temperature, maxTokens } = this.options;
        const prompt = this.buildFIMPrompt(request);

        const response = await axios.post(
            apiEndpoint || 'https://api.openai.com/v1/completions',
            {
                model: model || 'gpt-3.5-turbo-instruct',
                prompt,
                max_tokens: request.maxTokens || maxTokens || 256,
                temperature: request.temperature ?? temperature ?? 0,
                stop: request.stopSequences || ['\n\n']
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            completion: response.data.choices[0]?.text || '',
            finishReason: response.data.choices[0]?.finish_reason,
            usage: {
                promptTokens: response.data.usage?.prompt_tokens || 0,
                completionTokens: response.data.usage?.completion_tokens || 0
            }
        };
    }

    private async completeAnthropic(request: CompletionRequest): Promise<CompletionResponse> {
        const { apiKey, apiEndpoint, model, temperature, maxTokens } = this.options;
        const prompt = this.buildFIMPrompt(request);

        const response = await axios.post(
            apiEndpoint || 'https://api.anthropic.com/v1/messages',
            {
                model: model || 'claude-3-haiku-20240307',
                max_tokens: request.maxTokens || maxTokens || 256,
                messages: [
                    {
                        role: 'user',
                        content: `Complete the following code. Only output the completion, nothing else.\n\n${prompt}`
                    }
                ],
                temperature: request.temperature ?? temperature ?? 0
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.content[0];
        return {
            completion: content?.text || '',
            finishReason: response.data.stop_reason,
            usage: {
                promptTokens: response.data.usage?.input_tokens || 0,
                completionTokens: response.data.usage?.output_tokens || 0
            }
        };
    }

    private async completeOllama(request: CompletionRequest): Promise<CompletionResponse> {
        const { apiEndpoint, model, temperature, maxTokens } = this.options;
        const prompt = this.buildFIMPrompt(request);

        const response = await axios.post(
            `${apiEndpoint || 'http://localhost:11434'}/api/generate`,
            {
                model: model || 'codellama',
                prompt,
                options: {
                    temperature: request.temperature ?? temperature ?? 0,
                    num_predict: request.maxTokens || maxTokens || 256
                },
                stream: false
            }
        );

        return {
            completion: response.data.response || '',
            finishReason: response.data.done ? 'stop' : 'length'
        };
    }

    private buildFIMPrompt(request: CompletionRequest): string {
        const { prefix, suffix, language } = request;

        if (this.options.provider === 'ollama') {
            return `<PRE> ${prefix} <SUF>${suffix} <MID>`;
        }

        return `// Language: ${language}\n${prefix}<FILL_HERE>${suffix}`;
    }

    setOptions(options: Partial<LLMClientOptions>): void {
        this.options = { ...this.options, ...options };
    }

    getOptions(): LLMClientOptions {
        return { ...this.options };
    }
}
