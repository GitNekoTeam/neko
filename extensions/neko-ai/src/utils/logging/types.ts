export interface CompactLogEntry {
    t: number;
    l: string;
    m: string;
    c?: string;
    d?: unknown;
}

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogMeta {
    ctx?: string;
    [key: string]: unknown;
}

export interface CompactTransportConfig {
    level?: LogLevel;
    fileOutput?: {
        enabled: boolean;
        path: string;
    };
}

export interface ICompactTransport {
    write(entry: CompactLogEntry): void;
    close(): void;
}

export interface ILogger {
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string | Error, meta?: LogMeta): void;
    fatal(message: string | Error, meta?: LogMeta): void;
    child(meta: LogMeta): ILogger;
    close(): void;
}
