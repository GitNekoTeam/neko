import { tiktoken } from '../utils/tiktoken';
import { CountTokensResult } from './types';

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

async function countTokens(
    content: ContentBlockParam[]
): Promise<CountTokensResult> {
    try {
        const count = await tiktoken(content);
        return { success: true, count };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

async function initWorker(): Promise<void> {
    try {
        const workerpool = await import('workerpool');
        workerpool.worker({
            countTokens: (content: unknown) => countTokens(content as ContentBlockParam[])
        });
    } catch (error) {
        console.error('Failed to initialize worker:', error);
    }
}

initWorker();
