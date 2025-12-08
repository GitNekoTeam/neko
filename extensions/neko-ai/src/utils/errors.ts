export class NekoError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'NekoError';
    }
}

export class ApiError extends NekoError {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly provider?: string,
        details?: Record<string, unknown>
    ) {
        super(message, 'API_ERROR', details);
        this.name = 'ApiError';
    }

    get isRetryable(): boolean {
        if (!this.statusCode) return false;
        return this.statusCode === 429 || this.statusCode >= 500;
    }
}

export class AuthenticationError extends NekoError {
    constructor(message: string, provider?: string) {
        super(message, 'AUTH_ERROR', { provider });
        this.name = 'AuthenticationError';
    }
}

export class RateLimitError extends ApiError {
    constructor(
        message: string,
        public readonly retryAfter?: number,
        provider?: string
    ) {
        super(message, 429, provider, { retryAfter });
        this.name = 'RateLimitError';
    }
}

export class TimeoutError extends NekoError {
    constructor(message: string, public readonly timeoutMs: number) {
        super(message, 'TIMEOUT_ERROR', { timeoutMs });
        this.name = 'TimeoutError';
    }
}

export class ValidationError extends NekoError {
    constructor(message: string, public readonly field?: string) {
        super(message, 'VALIDATION_ERROR', { field });
        this.name = 'ValidationError';
    }
}

export class FileSystemError extends NekoError {
    constructor(
        message: string,
        public readonly path: string,
        public readonly operation: 'read' | 'write' | 'delete' | 'access'
    ) {
        super(message, 'FS_ERROR', { path, operation });
        this.name = 'FileSystemError';
    }
}

export class ConfigurationError extends NekoError {
    constructor(message: string, public readonly configKey?: string) {
        super(message, 'CONFIG_ERROR', { configKey });
        this.name = 'ConfigurationError';
    }
}

export class ToolExecutionError extends NekoError {
    constructor(
        message: string,
        public readonly toolName: string,
        public readonly originalError?: Error
    ) {
        super(message, 'TOOL_ERROR', {
            toolName,
            originalError: originalError?.message
        });
        this.name = 'ToolExecutionError';
    }
}

export class ContextLimitError extends NekoError {
    constructor(
        message: string,
        public readonly currentTokens: number,
        public readonly maxTokens: number
    ) {
        super(message, 'CONTEXT_LIMIT_ERROR', { currentTokens, maxTokens });
        this.name = 'ContextLimitError';
    }
}

export function isNekoError(error: unknown): error is NekoError {
    return error instanceof NekoError;
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

export function isRetryableError(error: unknown): boolean {
    if (error instanceof ApiError) {
        return error.isRetryable;
    }
    if (error instanceof TimeoutError) {
        return true;
    }
    return false;
}

export function formatError(error: unknown): string {
    if (error instanceof NekoError) {
        return `[${error.code}] ${error.message}`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function wrapError(error: unknown, context: string): NekoError {
    if (error instanceof NekoError) {
        return new NekoError(
            `${context}: ${error.message}`,
            error.code,
            error.details
        );
    }
    if (error instanceof Error) {
        return new NekoError(
            `${context}: ${error.message}`,
            'UNKNOWN_ERROR',
            { originalError: error.message }
        );
    }
    return new NekoError(
        `${context}: ${String(error)}`,
        'UNKNOWN_ERROR'
    );
}
