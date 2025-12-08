import * as path from 'path';

interface SimpleGitInstance {
    checkIsRepo(): Promise<boolean>;
    init(): Promise<void>;
    addConfig(key: string, value: string): Promise<void>;
    status(): Promise<{ files: Array<{ file: string }> }>;
    add(files: string): Promise<void>;
    commit(message: string, options?: string[]): Promise<{ commit: string; summary?: { changes: number; insertions: number; deletions: number } }>;
    log(options?: { maxCount?: number }): Promise<{ latest?: { hash: string; message: string; date: string }; all: Array<{ hash: string; message: string; date: string }> }>;
    reset(args: string[]): Promise<void>;
    diffSummary(args: string[]): Promise<{ files: Array<{ file: string }> }>;
    show(args: string[]): Promise<string>;
}

export interface CheckpointResult {
    commit: string;
    branch?: string;
    summary?: {
        changes: number;
        insertions: number;
        deletions: number;
    };
}

export interface CheckpointDiff {
    paths: {
        relative: string;
        absolute: string;
    };
    content: {
        before: string;
        after: string;
    };
}

export interface CheckpointServiceOptions {
    taskId: string;
    workspaceDir: string;
    shadowDir: string;
    log?: (message: string) => void;
}

export interface CheckpointEvent {
    type: 'initialize' | 'checkpoint' | 'restore' | 'error';
    data: Record<string, unknown>;
}

export type CheckpointEventHandler = (event: CheckpointEvent) => void;

export class CheckpointService {
    private taskId: string;
    private workspaceDir: string;
    private shadowDir: string;
    private git: SimpleGitInstance;
    private baseHash: string | null = null;
    private initialized: boolean = false;
    private log: (message: string) => void;
    private eventHandlers: CheckpointEventHandler[] = [];

    constructor(options: CheckpointServiceOptions) {
        this.taskId = options.taskId;
        this.workspaceDir = options.workspaceDir;
        this.shadowDir = options.shadowDir;
        this.log = options.log || console.log;
        this.git = null as unknown as SimpleGitInstance;
    }

    private async ensureGit(): Promise<void> {
        if (!this.git || this.git === null) {
            const simpleGit = (await import('simple-git')).default;
            this.git = simpleGit(this.workspaceDir) as unknown as SimpleGitInstance;
        }
    }

    async initialize(): Promise<{ baseHash: string; created: boolean }> {
        const startTime = Date.now();
        await this.ensureGit();

        try {
            const isRepo = await this.git.checkIsRepo();

            if (!isRepo) {
                await this.git.init();
                await this.git.addConfig('user.email', 'neko@local');
                await this.git.addConfig('user.name', 'Neko Checkpoint');
            }

            const hasCommits = await this.hasCommits();

            if (!hasCommits) {
                await this.git.add('.');
                await this.git.commit('Initial checkpoint', ['--allow-empty']);
            }

            const log = await this.git.log({ maxCount: 1 });
            this.baseHash = log.latest?.hash ?? '';
            this.initialized = true;

            const duration = Date.now() - startTime;
            this.emitEvent({
                type: 'initialize',
                data: {
                    workspaceDir: this.workspaceDir,
                    baseHash: this.baseHash,
                    created: !hasCommits,
                    duration
                }
            });

            return { baseHash: this.baseHash, created: !hasCommits };
        } catch (error) {
            this.emitEvent({
                type: 'error',
                data: { error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }

    async createCheckpoint(message?: string): Promise<CheckpointResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const fromHash = await this.getCurrentHash();

        try {
            await this.git.add('.');

            const status = await this.git.status();
            if (status.files.length === 0) {
                return { commit: fromHash };
            }

            const commitMessage = message || `Checkpoint ${new Date().toISOString()}`;
            const result = await this.git.commit(commitMessage);

            const toHash = result.commit || fromHash;
            const duration = Date.now() - startTime;

            this.emitEvent({
                type: 'checkpoint',
                data: { fromHash, toHash, duration }
            });

            return {
                commit: toHash,
                summary: result.summary
            };
        } catch (error) {
            this.emitEvent({
                type: 'error',
                data: { error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }

    async restoreCheckpoint(commitHash: string): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            await this.git.reset(['--hard', commitHash]);

            const duration = Date.now() - startTime;
            this.emitEvent({
                type: 'restore',
                data: { commitHash, duration }
            });
        } catch (error) {
            this.emitEvent({
                type: 'error',
                data: { error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
    }

    async getDiff(fromHash: string, toHash: string): Promise<CheckpointDiff[]> {
        const diffs: CheckpointDiff[] = [];

        try {
            const diffSummary = await this.git.diffSummary([fromHash, toHash]);

            for (const file of diffSummary.files) {
                const relativePath = file.file;
                const absolutePath = path.join(this.workspaceDir, relativePath);

                let before = '';
                let after = '';

                try {
                    before = await this.git.show([`${fromHash}:${relativePath}`]);
                } catch {
                    // File didn't exist in fromHash
                }

                try {
                    after = await this.git.show([`${toHash}:${relativePath}`]);
                } catch {
                    // File doesn't exist in toHash
                }

                diffs.push({
                    paths: { relative: relativePath, absolute: absolutePath },
                    content: { before, after }
                });
            }
        } catch (error) {
            this.log(`Failed to get diff: ${error}`);
        }

        return diffs;
    }

    async getCheckpointHistory(): Promise<Array<{ hash: string; message: string; date: Date }>> {
        if (!this.initialized) {
            await this.initialize();
        }

        const log = await this.git.log({ maxCount: 50 });

        return log.all.map((commit: { hash: string; message: string; date: string }) => ({
            hash: commit.hash,
            message: commit.message,
            date: new Date(commit.date)
        }));
    }

    async getCurrentHash(): Promise<string> {
        const log = await this.git.log({ maxCount: 1 });
        return log.latest?.hash || '';
    }

    private async hasCommits(): Promise<boolean> {
        try {
            await this.git.log({ maxCount: 1 });
            return true;
        } catch {
            return false;
        }
    }

    onEvent(handler: CheckpointEventHandler): void {
        this.eventHandlers.push(handler);
    }

    private emitEvent(event: CheckpointEvent): void {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            } catch (error) {
                console.error('Checkpoint event handler error:', error);
            }
        }
    }
}
