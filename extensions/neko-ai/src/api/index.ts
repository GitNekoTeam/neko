import { ApiConfiguration, ApiProvider } from '../shared/api';
import { ApiStream } from './transform/stream';

interface MessageParam {
    role: 'user' | 'assistant';
    content: string | ContentBlockParam[];
}

interface ContentBlockParam {
    type: string;
    text?: string;
    source?: {
        type: string;
        media_type?: string;
        data?: string;
    };
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | ContentBlockParam[];
}

export interface ApiHandlerMetadata {
    taskId: string;
    mode?: string;
    store?: boolean;
}

export interface ApiHandler {
    createMessage(
        systemPrompt: string,
        messages: MessageParam[],
        metadata?: ApiHandlerMetadata
    ): ApiStream;

    getModel(): { id: string; info: ModelInfo };

    countTokens(content: ContentBlockParam[]): Promise<number>;
}

export interface ModelInfo {
    maxTokens: number;
    contextWindow: number;
    supportsImages: boolean;
    supportsTools: boolean;
    inputPrice: number;
    outputPrice: number;
}

export async function buildApiHandler(configuration: ApiConfiguration): Promise<ApiHandler> {
    const provider = configuration.provider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = configuration as any;

    switch (provider) {
        case 'openai': {
            const { OpenAIProvider } = await import('./providers/OpenAIProvider.js');
            return new OpenAIProvider(config) as unknown as ApiHandler;
        }
        case 'anthropic': {
            const { AnthropicProvider } = await import('./providers/AnthropicProvider.js');
            return new AnthropicProvider(config) as unknown as ApiHandler;
        }
        case 'ollama': {
            const { OllamaProvider } = await import('./providers/OllamaProvider.js');
            return new OllamaProvider(config) as unknown as ApiHandler;
        }
        case 'openrouter': {
            const { OpenRouterProvider } = await import('./providers/OpenRouterProvider.js');
            return new OpenRouterProvider(config) as unknown as ApiHandler;
        }
        case 'azure': {
            const { AzureProvider } = await import('./providers/AzureProvider.js');
            return new AzureProvider(config) as unknown as ApiHandler;
        }
        case 'gemini': {
            const { GeminiProvider } = await import('./providers/GeminiProvider.js');
            return new GeminiProvider(config) as unknown as ApiHandler;
        }
        case 'deepseek': {
            const { DeepSeekProvider } = await import('./providers/DeepSeekProvider.js');
            return new DeepSeekProvider(config) as unknown as ApiHandler;
        }
        case 'mistral': {
            const { MistralProvider } = await import('./providers/MistralProvider.js');
            return new MistralProvider(config) as unknown as ApiHandler;
        }
        case 'groq': {
            const { GroqProvider } = await import('./providers/GroqProvider.js');
            return new GroqProvider(config) as unknown as ApiHandler;
        }
        case 'xai': {
            const { XAIProvider } = await import('./providers/XAIProvider.js');
            return new XAIProvider(config) as unknown as ApiHandler;
        }
        case 'bedrock': {
            const { BedrockProvider } = await import('./providers/BedrockProvider.js');
            return new BedrockProvider(config) as unknown as ApiHandler;
        }
        case 'cohere': {
            const { CohereProvider } = await import('./providers/CohereProvider.js');
            return new CohereProvider(config) as unknown as ApiHandler;
        }
        case 'together': {
            const { TogetherProvider } = await import('./providers/TogetherProvider.js');
            return new TogetherProvider(config) as unknown as ApiHandler;
        }
        case 'moonshot': {
            const { MoonshotProvider } = await import('./providers/MoonshotProvider.js');
            return new MoonshotProvider(config) as unknown as ApiHandler;
        }
        case 'qwen': {
            const { QwenProvider } = await import('./providers/QwenProvider.js');
            return new QwenProvider(config) as unknown as ApiHandler;
        }
        case 'custom': {
            const { CustomProvider } = await import('./providers/CustomProvider.js');
            return new CustomProvider(config) as unknown as ApiHandler;
        }
        default: {
            const { AnthropicProvider } = await import('./providers/AnthropicProvider.js');
            return new AnthropicProvider(config) as unknown as ApiHandler;
        }
    }
}

export function getProviderName(provider: ApiProvider): string {
    const names: Record<ApiProvider, string> = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        ollama: 'Ollama',
        openrouter: 'OpenRouter',
        azure: 'Azure OpenAI',
        gemini: 'Google Gemini',
        deepseek: 'DeepSeek',
        mistral: 'Mistral',
        groq: 'Groq',
        xai: 'xAI',
        bedrock: 'AWS Bedrock',
        cohere: 'Cohere',
        together: 'Together AI',
        moonshot: 'Moonshot',
        qwen: 'Qwen',
        custom: 'Custom'
    };
    return names[provider] || provider;
}

export * from './transform';
export * from '../shared/api';
