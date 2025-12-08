import * as fs from 'fs';
import { CompactLogEntry, CompactTransportConfig, ICompactTransport, LOG_LEVELS, LogLevel } from './types';

export class CompactTransport implements ICompactTransport {
    private level: LogLevel;
    private fileStream: fs.WriteStream | null = null;

    constructor(config: CompactTransportConfig = {}) {
        this.level = config.level || 'info';

        if (config.fileOutput?.enabled && config.fileOutput.path) {
            this.fileStream = fs.createWriteStream(config.fileOutput.path, { flags: 'a' });
        }
    }

    write(entry: CompactLogEntry): void {
        const entryLevel = entry.l as LogLevel;
        const entryLevelIndex = LOG_LEVELS.indexOf(entryLevel);
        const configLevelIndex = LOG_LEVELS.indexOf(this.level);

        if (entryLevelIndex < configLevelIndex) {
            return;
        }

        const line = JSON.stringify(entry) + '\n';

        if (this.fileStream) {
            this.fileStream.write(line);
        }

        this.writeToConsole(entry);
    }

    private writeToConsole(entry: CompactLogEntry): void {
        const timestamp = new Date().toISOString();
        const level = entry.l.toUpperCase().padEnd(5);
        const context = entry.c ? `[${entry.c}] ` : '';
        const message = `${timestamp} ${level} ${context}${entry.m}`;

        switch (entry.l) {
            case 'debug':
                console.debug(message, entry.d || '');
                break;
            case 'info':
                console.info(message, entry.d || '');
                break;
            case 'warn':
                console.warn(message, entry.d || '');
                break;
            case 'error':
            case 'fatal':
                console.error(message, entry.d || '');
                break;
            default:
                console.log(message, entry.d || '');
        }
    }

    close(): void {
        if (this.fileStream) {
            this.fileStream.end();
            this.fileStream = null;
        }
    }
}
