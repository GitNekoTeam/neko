import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface GitStatus {
    staged: string[];
    modified: string[];
    untracked: string[];
    deleted: string[];
}

export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: Date;
}

export interface GitDiff {
    file: string;
    additions: number;
    deletions: number;
    content: string;
}

export class GitService implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private workspacePath: string | undefined;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private async runGitCommand(args: string[]): Promise<string> {
        if (!this.workspacePath) {
            throw new Error('No workspace folder open');
        }

        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';

            const proc = spawn('git', args, {
                cwd: this.workspacePath,
                env: process.env
            });

            proc.stdout?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });

            proc.on('close', (code: number | null) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(errorOutput || `Git command failed with code ${code}`));
                }
            });

            proc.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    async isGitRepository(): Promise<boolean> {
        try {
            await this.runGitCommand(['rev-parse', '--git-dir']);
            return true;
        } catch {
            return false;
        }
    }

    async getCurrentBranch(): Promise<string> {
        return this.runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']);
    }

    async getStatus(): Promise<GitStatus> {
        const output = await this.runGitCommand(['status', '--porcelain']);
        const lines = output.split('\n').filter(l => l.trim());

        const status: GitStatus = {
            staged: [],
            modified: [],
            untracked: [],
            deleted: []
        };

        for (const line of lines) {
            const indexStatus = line[0];
            const workTreeStatus = line[1];
            const file = line.slice(3);

            if (indexStatus === 'A' || indexStatus === 'M' || indexStatus === 'D') {
                status.staged.push(file);
            }

            if (workTreeStatus === 'M') {
                status.modified.push(file);
            } else if (workTreeStatus === 'D') {
                status.deleted.push(file);
            } else if (indexStatus === '?' && workTreeStatus === '?') {
                status.untracked.push(file);
            }
        }

        return status;
    }

    async getStagedDiff(): Promise<string> {
        return this.runGitCommand(['diff', '--cached']);
    }

    async getUnstagedDiff(): Promise<string> {
        return this.runGitCommand(['diff']);
    }

    async getFileDiff(file: string, staged = false): Promise<string> {
        const args = staged ? ['diff', '--cached', '--', file] : ['diff', '--', file];
        return this.runGitCommand(args);
    }

    async getDiffStats(): Promise<GitDiff[]> {
        const output = await this.runGitCommand(['diff', '--cached', '--numstat']);
        const lines = output.split('\n').filter(l => l.trim());
        const diffs: GitDiff[] = [];

        for (const line of lines) {
            const [additions, deletions, file] = line.split('\t');
            diffs.push({
                file,
                additions: parseInt(additions, 10) || 0,
                deletions: parseInt(deletions, 10) || 0,
                content: ''
            });
        }

        return diffs;
    }

    async getRecentCommits(count = 10): Promise<GitCommit[]> {
        const format = '%H|%h|%s|%an|%aI';
        const output = await this.runGitCommand(['log', `-${count}`, `--format=${format}`]);
        const lines = output.split('\n').filter(l => l.trim());

        return lines.map(line => {
            const [hash, shortHash, message, author, date] = line.split('|');
            return {
                hash,
                shortHash,
                message,
                author,
                date: new Date(date)
            };
        });
    }

    async stageFile(file: string): Promise<void> {
        await this.runGitCommand(['add', file]);
    }

    async stageAll(): Promise<void> {
        await this.runGitCommand(['add', '-A']);
    }

    async unstageFile(file: string): Promise<void> {
        await this.runGitCommand(['reset', 'HEAD', '--', file]);
    }

    async commit(message: string): Promise<string> {
        return this.runGitCommand(['commit', '-m', message]);
    }

    async getRemoteUrl(): Promise<string | undefined> {
        try {
            return await this.runGitCommand(['remote', 'get-url', 'origin']);
        } catch {
            return undefined;
        }
    }

    formatStatusForPrompt(status: GitStatus): string {
        let output = '## Git Status\n\n';

        if (status.staged.length > 0) {
            output += '### Staged Changes\n';
            for (const file of status.staged) {
                output += `- ${file}\n`;
            }
            output += '\n';
        }

        if (status.modified.length > 0) {
            output += '### Modified Files\n';
            for (const file of status.modified) {
                output += `- ${file}\n`;
            }
            output += '\n';
        }

        if (status.untracked.length > 0) {
            output += '### Untracked Files\n';
            for (const file of status.untracked.slice(0, 10)) {
                output += `- ${file}\n`;
            }
            if (status.untracked.length > 10) {
                output += `- ... and ${status.untracked.length - 10} more\n`;
            }
            output += '\n';
        }

        if (status.deleted.length > 0) {
            output += '### Deleted Files\n';
            for (const file of status.deleted) {
                output += `- ${file}\n`;
            }
            output += '\n';
        }

        return output;
    }

    async getContextForCommitMessage(): Promise<string> {
        const status = await this.getStatus();
        const diff = await this.getStagedDiff();
        const branch = await this.getCurrentBranch();

        let context = `Current branch: ${branch}\n\n`;
        context += this.formatStatusForPrompt(status);
        
        if (diff) {
            const truncatedDiff = diff.length > 5000 ? diff.slice(0, 5000) + '\n... (truncated)' : diff;
            context += '### Diff\n```diff\n' + truncatedDiff + '\n```\n';
        }

        return context;
    }

    dispose(): void {
        // Cleanup
    }
}
