export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
    cacheReadPer1M?: number;
    cacheWritePer1M?: number;
}

export interface UsageCost {
    inputCost: number;
    outputCost: number;
    cacheCost: number;
    totalCost: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
    'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
    'gpt-4': { inputPer1M: 30, outputPer1M: 60 },
    'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
    'claude-3-5-sonnet-20241022': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
    'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4, cacheReadPer1M: 0.08, cacheWritePer1M: 1 },
    'claude-3-opus-20240229': { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.5, cacheWritePer1M: 18.75 },
    'claude-3-sonnet-20240229': { inputPer1M: 3, outputPer1M: 15 },
    'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
    'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5 },
    'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
    'gemini-2.0-flash-exp': { inputPer1M: 0, outputPer1M: 0 },
    'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28, cacheReadPer1M: 0.014 },
    'deepseek-coder': { inputPer1M: 0.14, outputPer1M: 0.28 },
    'mistral-large-latest': { inputPer1M: 2, outputPer1M: 6 },
    'mistral-small-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
    'codestral-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
    'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
    'llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
    'grok-2-latest': { inputPer1M: 2, outputPer1M: 10 },
    'qwen-max': { inputPer1M: 1.6, outputPer1M: 6.4 },
    'qwen-plus': { inputPer1M: 0.4, outputPer1M: 1.2 },
    'moonshot-v1-128k': { inputPer1M: 8.5, outputPer1M: 8.5 },
    'moonshot-v1-8k': { inputPer1M: 1.7, outputPer1M: 1.7 },
    'command-r-plus': { inputPer1M: 2.5, outputPer1M: 10 },
    'command-r': { inputPer1M: 0.15, outputPer1M: 0.6 }
};

export function getModelPricing(model: string): ModelPricing | undefined {
    const normalizedModel = model.toLowerCase();
    
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
        if (normalizedModel.includes(key.toLowerCase())) {
            return pricing;
        }
    }
    
    return undefined;
}

export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number = 0,
    cacheWriteTokens: number = 0
): UsageCost {
    const pricing = getModelPricing(model);
    
    if (!pricing) {
        return { inputCost: 0, outputCost: 0, cacheCost: 0, totalCost: 0 };
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    
    let cacheCost = 0;
    if (pricing.cacheReadPer1M && cacheReadTokens > 0) {
        cacheCost += (cacheReadTokens / 1_000_000) * pricing.cacheReadPer1M;
    }
    if (pricing.cacheWritePer1M && cacheWriteTokens > 0) {
        cacheCost += (cacheWriteTokens / 1_000_000) * pricing.cacheWritePer1M;
    }

    return {
        inputCost,
        outputCost,
        cacheCost,
        totalCost: inputCost + outputCost + cacheCost
    };
}

export function formatCost(cost: number): string {
    if (cost < 0.01) {
        return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toString();
}

export class CostTracker {
    private totalInputTokens: number = 0;
    private totalOutputTokens: number = 0;
    private totalCacheReadTokens: number = 0;
    private totalCacheWriteTokens: number = 0;
    private totalCost: number = 0;
    private requestCount: number = 0;

    addUsage(
        model: string,
        inputTokens: number,
        outputTokens: number,
        cacheReadTokens: number = 0,
        cacheWriteTokens: number = 0
    ): UsageCost {
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;
        this.totalCacheReadTokens += cacheReadTokens;
        this.totalCacheWriteTokens += cacheWriteTokens;
        this.requestCount++;

        const cost = calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
        this.totalCost += cost.totalCost;

        return cost;
    }

    getStats(): {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        totalCost: number;
        requestCount: number;
    } {
        return {
            inputTokens: this.totalInputTokens,
            outputTokens: this.totalOutputTokens,
            cacheReadTokens: this.totalCacheReadTokens,
            cacheWriteTokens: this.totalCacheWriteTokens,
            totalCost: this.totalCost,
            requestCount: this.requestCount
        };
    }

    reset(): void {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalCacheReadTokens = 0;
        this.totalCacheWriteTokens = 0;
        this.totalCost = 0;
        this.requestCount = 0;
    }
}
