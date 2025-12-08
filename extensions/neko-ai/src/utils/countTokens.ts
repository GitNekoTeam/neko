import { countTokensResultSchema } from '../workers/types';
import { tiktoken } from './tiktoken';

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

interface WorkerPool {
    exec(method: string, args: unknown[]): Promise<unknown>;
    terminate(): void;
}

let pool: WorkerPool | null | undefined = undefined;

export interface CountTokensOptions {
    useWorker?: boolean;
}

export async function countTokens(
    content: ContentBlockParam[],
    options: CountTokensOptions = {}
): Promise<number> {
    const { useWorker = true } = options;

    if (useWorker && typeof pool === 'undefined') {
        try {
            const workerpool = await import('workerpool');
            pool = workerpool.pool(__dirname + '/workers/countTokens.js', {
                maxWorkers: 1,
                maxQueueSize: 10
            }) as unknown as WorkerPool;
        } catch {
            pool = null;
        }
    }

    if (!useWorker || !pool) {
        return tiktoken(content);
    }

    try {
        const data = await pool.exec('countTokens', [content]);
        const result = countTokensResultSchema.parse(data);

        if (!result.success) {
            throw new Error(result.error);
        }

        return result.count;
    } catch (error) {
        pool = null;
        console.error(error);
        return tiktoken(content);
    }
}

export function terminateTokenPool(): void {
    if (pool) {
        pool.terminate();
        pool = null;
    }
}
