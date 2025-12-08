declare module 'workerpool' {
    interface Pool {
        exec(method: string, args: unknown[]): Promise<unknown>;
        terminate(): void;
    }

    interface PoolOptions {
        maxWorkers?: number;
        maxQueueSize?: number;
    }

    function pool(script: string, options?: PoolOptions): Pool;
    function worker(methods: Record<string, (...args: unknown[]) => unknown>): void;
}
