import * as vscode from 'vscode';
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { AzureProvider } from './AzureProvider';
import { GeminiProvider } from './GeminiProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { MistralProvider } from './MistralProvider';
import { GroqProvider } from './GroqProvider';
import { XAIProvider } from './XAIProvider';
import { BedrockProvider } from './BedrockProvider';
import { CohereProvider } from './CohereProvider';
import { TogetherProvider } from './TogetherProvider';
import { MoonshotProvider } from './MoonshotProvider';
import { QwenProvider } from './QwenProvider';
import { CustomProvider } from './CustomProvider';

export type ProviderType = 
    | 'openai' 
    | 'anthropic' 
    | 'ollama' 
    | 'openrouter' 
    | 'azure' 
    | 'gemini' 
    | 'deepseek'
    | 'mistral'
    | 'groq'
    | 'xai'
    | 'bedrock'
    | 'cohere'
    | 'together'
    | 'moonshot'
    | 'qwen'
    | 'custom';

export interface ProviderInfo {
    id: ProviderType;
    name: string;
    description: string;
    website: string;
    requiresApiKey: boolean;
    supportsEmbedding: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    defaultModel: string;
    models: string[];
}

export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
    openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5 and other OpenAI models',
        website: 'https://platform.openai.com',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o1-preview']
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 3.5, Claude 3 and other Anthropic models',
        website: 'https://console.anthropic.com',
        requiresApiKey: true,
        supportsEmbedding: false,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
    },
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        description: 'Run open-source models locally',
        website: 'https://ollama.ai',
        requiresApiKey: false,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'llama3.2',
        models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'mixtral', 'qwen2.5-coder', 'deepseek-coder-v2']
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Access multiple AI providers through one API',
        website: 'https://openrouter.ai',
        requiresApiKey: true,
        supportsEmbedding: false,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'anthropic/claude-3.5-sonnet',
        models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'meta-llama/llama-3.1-405b-instruct']
    },
    azure: {
        id: 'azure',
        name: 'Azure OpenAI',
        description: 'OpenAI models hosted on Microsoft Azure',
        website: 'https://azure.microsoft.com/products/ai-services/openai-service',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-35-turbo']
    },
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini Pro, Gemini Flash and other Google models',
        website: 'https://ai.google.dev',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'gemini-1.5-pro',
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek Chat and Coder models',
        website: 'https://platform.deepseek.com',
        requiresApiKey: true,
        supportsEmbedding: false,
        supportsStreaming: true,
        supportsVision: false,
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
    },
    mistral: {
        id: 'mistral',
        name: 'Mistral AI',
        description: 'Mistral Large, Codestral and other Mistral models',
        website: 'https://console.mistral.ai',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: false,
        defaultModel: 'mistral-large-latest',
        models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'open-mistral-nemo']
    },
    groq: {
        id: 'groq',
        name: 'Groq',
        description: 'Ultra-fast inference with LPU technology',
        website: 'https://console.groq.com',
        requiresApiKey: true,
        supportsEmbedding: false,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'llama-3.3-70b-versatile',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']
    },
    xai: {
        id: 'xai',
        name: 'xAI (Grok)',
        description: 'Grok models from xAI',
        website: 'https://x.ai',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'grok-2-latest',
        models: ['grok-2-latest', 'grok-2-vision-latest', 'grok-beta']
    },
    bedrock: {
        id: 'bedrock',
        name: 'AWS Bedrock',
        description: 'Access foundation models on AWS',
        website: 'https://aws.amazon.com/bedrock',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        models: ['anthropic.claude-3-5-sonnet-20241022-v2:0', 'anthropic.claude-3-haiku-20240307-v1:0', 'amazon.titan-text-premier-v1:0']
    },
    cohere: {
        id: 'cohere',
        name: 'Cohere',
        description: 'Command R+ and other Cohere models',
        website: 'https://dashboard.cohere.com',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: false,
        defaultModel: 'command-r-plus',
        models: ['command-r-plus', 'command-r', 'command', 'command-light']
    },
    together: {
        id: 'together',
        name: 'Together AI',
        description: 'Run open-source models in the cloud',
        website: 'https://api.together.xyz',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo']
    },
    moonshot: {
        id: 'moonshot',
        name: 'Moonshot',
        description: 'Kimi models with long context support',
        website: 'https://platform.moonshot.cn',
        requiresApiKey: true,
        supportsEmbedding: false,
        supportsStreaming: true,
        supportsVision: false,
        defaultModel: 'moonshot-v1-128k',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k']
    },
    qwen: {
        id: 'qwen',
        name: 'Qwen',
        description: 'Alibaba Qwen models',
        website: 'https://dashscope.console.aliyun.com',
        requiresApiKey: true,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: true,
        defaultModel: 'qwen-max',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-turbo', 'qwen-vl-max']
    },
    custom: {
        id: 'custom',
        name: 'Custom Provider',
        description: 'Configure a custom OpenAI-compatible API',
        website: '',
        requiresApiKey: false,
        supportsEmbedding: true,
        supportsStreaming: true,
        supportsVision: false,
        defaultModel: 'gpt-4',
        models: []
    }
};

export class ApiProviderFactory {
    static create(config: vscode.WorkspaceConfiguration): BaseProvider {
        const providerType = config.get<ProviderType>('provider', 'openai');
        const apiKey = config.get<string>('apiKey', '');
        const apiEndpoint = config.get<string>('apiEndpoint', '');
        const model = config.get<string>('model', PROVIDER_INFO[providerType]?.defaultModel || 'gpt-4');
        const completionModel = config.get<string>('completionModel', '');
        const embeddingModel = config.get<string>('embeddingModel', '');
        const temperature = config.get<number>('temperature', 0.7);

        const options = {
            apiKey,
            apiEndpoint,
            model,
            completionModel: completionModel || model,
            embeddingModel: embeddingModel || 'text-embedding-3-small',
            temperature
        };

        switch (providerType) {
            case 'anthropic':
                return new AnthropicProvider(options);
            case 'ollama':
                return new OllamaProvider(options);
            case 'openrouter':
                return new OpenRouterProvider(options);
            case 'azure':
                return new AzureProvider(options);
            case 'gemini':
                return new GeminiProvider(options);
            case 'deepseek':
                return new DeepSeekProvider(options);
            case 'mistral':
                return new MistralProvider(options);
            case 'groq':
                return new GroqProvider(options);
            case 'xai':
                return new XAIProvider(options);
            case 'bedrock':
                return new BedrockProvider(options);
            case 'cohere':
                return new CohereProvider(options);
            case 'together':
                return new TogetherProvider(options);
            case 'moonshot':
                return new MoonshotProvider(options);
            case 'qwen':
                return new QwenProvider(options);
            case 'custom':
                return new CustomProvider(options);
            case 'openai':
            default:
                return new OpenAIProvider(options);
        }
    }

    static getProviderInfo(providerType: ProviderType): ProviderInfo {
        return PROVIDER_INFO[providerType];
    }

    static getAllProviders(): ProviderInfo[] {
        return Object.values(PROVIDER_INFO);
    }

    static getProviderTypes(): ProviderType[] {
        return Object.keys(PROVIDER_INFO) as ProviderType[];
    }
}
