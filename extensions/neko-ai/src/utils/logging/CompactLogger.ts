import { CompactLogEntry, ILogger, LogMeta, CompactTransportConfig } from './types';
import { CompactTransport } from './CompactTransport';

export class CompactLogger implements ILogger {
    private transport: CompactTransport;
    private baseMeta: LogMeta;
    private lastTimestamp: number = 0;

    constructor(config?: CompactTransportConfig, baseMeta: LogMeta = {}) {
        this.transport = new CompactTransport(config);
        this.baseMeta = baseMeta;
    }

    private log(level: string, message: string | Error, meta?: LogMeta): void {
        const now = Date.now();
        const delta = this.lastTimestamp ? now - this.lastTimestamp : 0;
        this.lastTimestamp = now;

        const mergedMeta = { ...this.baseMeta, ...meta };
        const messageStr = message instanceof Error ? message.message : message;

        const entry: CompactLogEntry = {
            t: delta,
            l: level,
            m: messageStr,
            c: mergedMeta.ctx,
            d: this.extractData(mergedMeta, message)
        };

        this.transport.write(entry);
    }

    private extractData(meta: LogMeta, message: string | Error): unknown | undefined {
        const data: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(meta)) {
            if (key !== 'ctx') {
                data[key] = value;
            }
        }

        if (message instanceof Error) {
            data.stack = message.stack;
            data.name = message.name;
        }

        return Object.keys(data).length > 0 ? data : undefined;
    }

    debug(message: string, meta?: LogMeta): void {
        this.log('debug', message, meta);
    }

    info(message: string, meta?: LogMeta): void {
        this.log('info', message, meta);
    }

    warn(message: string, meta?: LogMeta): void {
        this.log('warn', message, meta);
    }

    error(message: string | Error, meta?: LogMeta): void {
        this.log('error', message, meta);
    }

    fatal(message: string | Error, meta?: LogMeta): void {
        this.log('fatal', message, meta);
    }

    child(meta: LogMeta): ILogger {
        const mergedMeta = { ...this.baseMeta, ...meta };
        return new CompactLogger(undefined, mergedMeta);
    }

    close(): void {
        this.transport.close();
    }
}
