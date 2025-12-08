import * as vscode from 'vscode';
import * as path from 'path';

export interface PurgeConfig {
    enabled: boolean;
    maxAgeDays: number;
    maxSizeMB: number;
    maxItems: number;
    purgeOnStartup: boolean;
    purgeInterval: number;
}

export interface PurgeResult {
    deletedFiles: number;
    freedBytes: number;
    errors: string[];
}

export class AutoPurgeService implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private config: PurgeConfig;
    private timer: NodeJS.Timeout | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        
        if (this.config.purgeOnStartup) {
            this.purge();
        }

        if (this.config.enabled && this.config.purgeInterval > 0) {
            this.startTimer();
        }
    }

    private loadConfig(): PurgeConfig {
        const vsConfig = vscode.workspace.getConfiguration('neko-ai');
        return {
            enabled: vsConfig.get<boolean>('autoPurge.enabled') ?? true,
            maxAgeDays: vsConfig.get<number>('autoPurge.maxAgeDays') ?? 30,
            maxSizeMB: vsConfig.get<number>('autoPurge.maxSizeMB') ?? 500,
            maxItems: vsConfig.get<number>('autoPurge.maxItems') ?? 1000,
            purgeOnStartup: vsConfig.get<boolean>('autoPurge.purgeOnStartup') ?? false,
            purgeInterval: vsConfig.get<number>('autoPurge.purgeInterval') ?? 24
        };
    }

    private startTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }

        const intervalMs = this.config.purgeInterval * 60 * 60 * 1000;
        this.timer = setInterval(() => this.purge(), intervalMs);
    }

    async purge(): Promise<PurgeResult> {
        const result: PurgeResult = {
            deletedFiles: 0,
            freedBytes: 0,
            errors: []
        };

        try {
            const historyResult = await this.purgeHistory();
            result.deletedFiles += historyResult.deletedFiles;
            result.freedBytes += historyResult.freedBytes;
            result.errors.push(...historyResult.errors);

            const cacheResult = await this.purgeCache();
            result.deletedFiles += cacheResult.deletedFiles;
            result.freedBytes += cacheResult.freedBytes;
            result.errors.push(...cacheResult.errors);

            const logsResult = await this.purgeLogs();
            result.deletedFiles += logsResult.deletedFiles;
            result.freedBytes += logsResult.freedBytes;
            result.errors.push(...logsResult.errors);

        } catch (error) {
            result.errors.push(`Purge failed: ${error}`);
        }

        return result;
    }

    private async purgeHistory(): Promise<PurgeResult> {
        const result: PurgeResult = { deletedFiles: 0, freedBytes: 0, errors: [] };
        const historyDir = path.join(this.context.globalStorageUri.fsPath, 'history');

        try {
            const files = await this.getFilesOlderThan(historyDir, this.config.maxAgeDays);
            for (const file of files) {
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
                    await vscode.workspace.fs.delete(vscode.Uri.file(file));
                    result.deletedFiles++;
                    result.freedBytes += stat.size;
                } catch (e) {
                    result.errors.push(`Failed to delete ${file}: ${e}`);
                }
            }
        } catch {
            // Directory may not exist
        }

        return result;
    }

    private async purgeCache(): Promise<PurgeResult> {
        const result: PurgeResult = { deletedFiles: 0, freedBytes: 0, errors: [] };
        const cacheDir = path.join(this.context.globalStorageUri.fsPath, 'cache');

        try {
            const totalSize = await this.getDirectorySize(cacheDir);
            const maxBytes = this.config.maxSizeMB * 1024 * 1024;

            if (totalSize > maxBytes) {
                const files = await this.getFilesSortedByAge(cacheDir);
                let currentSize = totalSize;

                for (const file of files) {
                    if (currentSize <= maxBytes * 0.8) break;

                    try {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file.path));
                        await vscode.workspace.fs.delete(vscode.Uri.file(file.path));
                        result.deletedFiles++;
                        result.freedBytes += stat.size;
                        currentSize -= stat.size;
                    } catch (e) {
                        result.errors.push(`Failed to delete ${file.path}: ${e}`);
                    }
                }
            }
        } catch {
            // Directory may not exist
        }

        return result;
    }

    private async purgeLogs(): Promise<PurgeResult> {
        const result: PurgeResult = { deletedFiles: 0, freedBytes: 0, errors: [] };
        const logsDir = path.join(this.context.globalStorageUri.fsPath, 'logs');

        try {
            const files = await this.getFilesOlderThan(logsDir, 7);
            for (const file of files) {
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
                    await vscode.workspace.fs.delete(vscode.Uri.file(file));
                    result.deletedFiles++;
                    result.freedBytes += stat.size;
                } catch (e) {
                    result.errors.push(`Failed to delete ${file}: ${e}`);
                }
            }
        } catch {
            // Directory may not exist
        }

        return result;
    }

    private async getFilesOlderThan(dir: string, days: number): Promise<string[]> {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const oldFiles: string[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    const filePath = path.join(dir, name);
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.mtime < cutoff) {
                        oldFiles.push(filePath);
                    }
                }
            }
        } catch {
            // Directory may not exist
        }

        return oldFiles;
    }

    private async getFilesSortedByAge(dir: string): Promise<{ path: string; mtime: number }[]> {
        const files: { path: string; mtime: number }[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    const filePath = path.join(dir, name);
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    files.push({ path: filePath, mtime: stat.mtime });
                }
            }
        } catch {
            // Directory may not exist
        }

        return files.sort((a, b) => a.mtime - b.mtime);
    }

    private async getDirectorySize(dir: string): Promise<number> {
        let totalSize = 0;

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                const filePath = path.join(dir, name);
                if (type === vscode.FileType.File) {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    totalSize += stat.size;
                } else if (type === vscode.FileType.Directory) {
                    totalSize += await this.getDirectorySize(filePath);
                }
            }
        } catch {
            // Directory may not exist
        }

        return totalSize;
    }

    updateConfig(config: Partial<PurgeConfig>): void {
        this.config = { ...this.config, ...config };
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.config.enabled && this.config.purgeInterval > 0) {
            this.startTimer();
        }
    }

    getConfig(): PurgeConfig {
        return { ...this.config };
    }

    async getStorageStats(): Promise<{ historySize: number; cacheSize: number; logsSize: number; totalSize: number }> {
        const historyDir = path.join(this.context.globalStorageUri.fsPath, 'history');
        const cacheDir = path.join(this.context.globalStorageUri.fsPath, 'cache');
        const logsDir = path.join(this.context.globalStorageUri.fsPath, 'logs');

        const historySize = await this.getDirectorySize(historyDir);
        const cacheSize = await this.getDirectorySize(cacheDir);
        const logsSize = await this.getDirectorySize(logsDir);

        return {
            historySize,
            cacheSize,
            logsSize,
            totalSize: historySize + cacheSize + logsSize
        };
    }

    dispose(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
