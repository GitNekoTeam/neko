import * as vscode from 'vscode';

export interface QueuedMessage {
    id: string;
    type: 'user' | 'system' | 'tool';
    content: string;
    priority: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
    retryCount: number;
    maxRetries: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface MessageQueueOptions {
    maxSize: number;
    maxRetries: number;
    processingTimeout: number;
    concurrency: number;
}

export class MessageQueue {
    private queue: QueuedMessage[] = [];
    private processing: Map<string, QueuedMessage> = new Map();
    private options: MessageQueueOptions;
    private processor: ((message: QueuedMessage) => Promise<void>) | null = null;
    private isRunning: boolean = false;
    private onCompleteCallbacks: ((message: QueuedMessage) => void)[] = [];
    private onErrorCallbacks: ((message: QueuedMessage, error: Error) => void)[] = [];

    constructor(options?: Partial<MessageQueueOptions>) {
        this.options = {
            maxSize: 100,
            maxRetries: 3,
            processingTimeout: 60000,
            concurrency: 1,
            ...options
        };
    }

    setProcessor(processor: (message: QueuedMessage) => Promise<void>): void {
        this.processor = processor;
    }

    enqueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
        if (this.queue.length >= this.options.maxSize) {
            const oldest = this.queue.shift();
            if (oldest) {
                this.notifyError(oldest, new Error('Queue overflow - message dropped'));
            }
        }

        const id = this.generateId();
        const queuedMessage: QueuedMessage = {
            ...message,
            id,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: message.maxRetries ?? this.options.maxRetries,
            status: 'pending'
        };

        this.insertByPriority(queuedMessage);
        this.processNext();

        return id;
    }

    private insertByPriority(message: QueuedMessage): void {
        const index = this.queue.findIndex(m => m.priority < message.priority);
        if (index === -1) {
            this.queue.push(message);
        } else {
            this.queue.splice(index, 0, message);
        }
    }

    private async processNext(): Promise<void> {
        if (!this.processor || !this.isRunning) return;
        if (this.processing.size >= this.options.concurrency) return;
        if (this.queue.length === 0) return;

        const message = this.queue.shift();
        if (!message) return;

        message.status = 'processing';
        this.processing.set(message.id, message);

        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Processing timeout')), this.options.processingTimeout);
            });

            await Promise.race([
                this.processor(message),
                timeoutPromise
            ]);

            message.status = 'completed';
            this.notifyComplete(message);
        } catch (error) {
            message.retryCount++;
            
            if (message.retryCount < message.maxRetries) {
                message.status = 'pending';
                this.insertByPriority(message);
            } else {
                message.status = 'failed';
                this.notifyError(message, error instanceof Error ? error : new Error(String(error)));
            }
        } finally {
            this.processing.delete(message.id);
            this.processNext();
        }
    }

    start(): void {
        this.isRunning = true;
        this.processNext();
    }

    stop(): void {
        this.isRunning = false;
    }

    pause(): void {
        this.isRunning = false;
    }

    resume(): void {
        this.isRunning = true;
        this.processNext();
    }

    cancel(messageId: string): boolean {
        const index = this.queue.findIndex(m => m.id === messageId);
        if (index >= 0) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }

    cancelAll(): void {
        this.queue = [];
    }

    getStatus(messageId: string): QueuedMessage['status'] | undefined {
        const inQueue = this.queue.find(m => m.id === messageId);
        if (inQueue) return inQueue.status;

        const inProcessing = this.processing.get(messageId);
        if (inProcessing) return inProcessing.status;

        return undefined;
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    getProcessingCount(): number {
        return this.processing.size;
    }

    getPendingMessages(): QueuedMessage[] {
        return [...this.queue];
    }

    onComplete(callback: (message: QueuedMessage) => void): vscode.Disposable {
        this.onCompleteCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onCompleteCallbacks.indexOf(callback);
            if (index >= 0) this.onCompleteCallbacks.splice(index, 1);
        });
    }

    onError(callback: (message: QueuedMessage, error: Error) => void): vscode.Disposable {
        this.onErrorCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onErrorCallbacks.indexOf(callback);
            if (index >= 0) this.onErrorCallbacks.splice(index, 1);
        });
    }

    private notifyComplete(message: QueuedMessage): void {
        for (const callback of this.onCompleteCallbacks) {
            try {
                callback(message);
            } catch {
                // Ignore callback errors
            }
        }
    }

    private notifyError(message: QueuedMessage, error: Error): void {
        for (const callback of this.onErrorCallbacks) {
            try {
                callback(message, error);
            } catch {
                // Ignore callback errors
            }
        }
    }

    private generateId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    clear(): void {
        this.queue = [];
        this.processing.clear();
    }

    getStats(): { pending: number; processing: number; isRunning: boolean } {
        return {
            pending: this.queue.length,
            processing: this.processing.size,
            isRunning: this.isRunning
        };
    }
}
