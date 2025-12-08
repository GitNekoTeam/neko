declare module 'simple-git' {
    interface SimpleGit {
        checkIsRepo(): Promise<boolean>;
        init(): Promise<void>;
        addConfig(key: string, value: string): Promise<void>;
        status(): Promise<StatusResult>;
        add(files: string | string[]): Promise<void>;
        commit(message: string, options?: string[]): Promise<CommitResult>;
        log(options?: LogOptions): Promise<LogResult>;
        reset(args: string[]): Promise<void>;
        diffSummary(args: string[]): Promise<DiffResult>;
        show(args: string[]): Promise<string>;
    }

    interface StatusResult {
        files: Array<{ file: string }>;
    }

    interface CommitResult {
        commit: string;
        summary?: {
            changes: number;
            insertions: number;
            deletions: number;
        };
    }

    interface LogOptions {
        maxCount?: number;
    }

    interface LogResult {
        latest?: {
            hash: string;
            message: string;
            date: string;
        };
        all: Array<{
            hash: string;
            message: string;
            date: string;
        }>;
    }

    interface DiffResult {
        files: Array<{ file: string }>;
    }

    function simpleGit(basePath?: string): SimpleGit;
    export default simpleGit;
}
