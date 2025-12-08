import { CompactLogger } from './CompactLogger';
import { ILogger } from './types';

const noopLogger: ILogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => noopLogger,
    close: () => {}
};

export const logger: ILogger = process.env.NODE_ENV === 'test' 
    ? noopLogger 
    : new CompactLogger();

export { CompactLogger } from './CompactLogger';
export { CompactTransport } from './CompactTransport';
export * from './types';
