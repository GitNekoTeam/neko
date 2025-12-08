export interface EmbeddingModelInfo {
    id: string;
    name: string;
    provider: string;
    dimensions: number;
    maxTokens: number;
    pricePerMillion?: number;
}

export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
    {
        id: 'text-embedding-3-small',
        name: 'OpenAI Embedding 3 Small',
        provider: 'openai',
        dimensions: 1536,
        maxTokens: 8191,
        pricePerMillion: 0.02
    },
    {
        id: 'text-embedding-3-large',
        name: 'OpenAI Embedding 3 Large',
        provider: 'openai',
        dimensions: 3072,
        maxTokens: 8191,
        pricePerMillion: 0.13
    },
    {
        id: 'text-embedding-ada-002',
        name: 'OpenAI Ada 002',
        provider: 'openai',
        dimensions: 1536,
        maxTokens: 8191,
        pricePerMillion: 0.1
    },
    {
        id: 'voyage-3',
        name: 'Voyage 3',
        provider: 'voyage',
        dimensions: 1024,
        maxTokens: 32000,
        pricePerMillion: 0.06
    },
    {
        id: 'voyage-3-lite',
        name: 'Voyage 3 Lite',
        provider: 'voyage',
        dimensions: 512,
        maxTokens: 32000,
        pricePerMillion: 0.02
    },
    {
        id: 'voyage-code-3',
        name: 'Voyage Code 3',
        provider: 'voyage',
        dimensions: 1024,
        maxTokens: 32000,
        pricePerMillion: 0.06
    },
    {
        id: 'mistral-embed',
        name: 'Mistral Embed',
        provider: 'mistral',
        dimensions: 1024,
        maxTokens: 8192,
        pricePerMillion: 0.1
    },
    {
        id: 'embed-english-v3.0',
        name: 'Cohere Embed English v3',
        provider: 'cohere',
        dimensions: 1024,
        maxTokens: 512,
        pricePerMillion: 0.1
    },
    {
        id: 'embed-multilingual-v3.0',
        name: 'Cohere Embed Multilingual v3',
        provider: 'cohere',
        dimensions: 1024,
        maxTokens: 512,
        pricePerMillion: 0.1
    },
    {
        id: 'text-embedding-v3',
        name: 'Qwen Text Embedding v3',
        provider: 'qwen',
        dimensions: 1024,
        maxTokens: 8192,
        pricePerMillion: 0.07
    },
    {
        id: 'amazon.titan-embed-text-v2:0',
        name: 'Amazon Titan Embed v2',
        provider: 'bedrock',
        dimensions: 1024,
        maxTokens: 8192,
        pricePerMillion: 0.02
    },
    {
        id: 'nomic-embed-text',
        name: 'Nomic Embed Text',
        provider: 'ollama',
        dimensions: 768,
        maxTokens: 8192,
        pricePerMillion: 0
    },
    {
        id: 'mxbai-embed-large',
        name: 'MixedBread Embed Large',
        provider: 'ollama',
        dimensions: 1024,
        maxTokens: 512,
        pricePerMillion: 0
    },
    {
        id: 'all-minilm',
        name: 'All MiniLM',
        provider: 'ollama',
        dimensions: 384,
        maxTokens: 512,
        pricePerMillion: 0
    }
];

export function getEmbeddingModel(modelId: string): EmbeddingModelInfo | undefined {
    return EMBEDDING_MODELS.find(m => m.id === modelId);
}

export function getEmbeddingModelsByProvider(provider: string): EmbeddingModelInfo[] {
    return EMBEDDING_MODELS.filter(m => m.provider === provider);
}

export function getDefaultEmbeddingModel(provider: string): EmbeddingModelInfo | undefined {
    const models = getEmbeddingModelsByProvider(provider);
    return models[0];
}

export function calculateEmbeddingCost(modelId: string, tokens: number): number {
    const model = getEmbeddingModel(modelId);
    if (!model || !model.pricePerMillion) {
        return 0;
    }
    return (tokens / 1_000_000) * model.pricePerMillion;
}
