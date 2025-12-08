import { z } from 'zod';

export const countTokensResultSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        count: z.number()
    }),
    z.object({
        success: z.literal(false),
        error: z.string()
    })
]);

export type CountTokensResult = z.infer<typeof countTokensResultSchema>;

export interface WorkerMessage<T = unknown> {
    id: string;
    type: string;
    payload: T;
}

export interface WorkerResponse<T = unknown> {
    id: string;
    success: boolean;
    result?: T;
    error?: string;
}
