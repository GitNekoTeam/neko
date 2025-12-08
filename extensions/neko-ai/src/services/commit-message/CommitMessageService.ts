import * as vscode from 'vscode';
import { BaseProvider } from '../../api/providers/BaseProvider';

export interface CommitMessageOptions {
    type?: 'conventional' | 'simple' | 'detailed';
    maxLength?: number;
    includeScope?: boolean;
    includeBody?: boolean;
    language?: string;
}

export interface GitDiff {
    files: DiffFile[];
    stats: { additions: number; deletions: number; files: number };
}

export interface DiffFile {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    diff?: string;
}

export class CommitMessageService {
    private provider: BaseProvider | null = null;
    private defaultOptions: CommitMessageOptions = {
        type: 'conventional',
        maxLength: 72,
        includeScope: true,
        includeBody: true,
        language: 'en'
    };

    setProvider(provider: BaseProvider): void {
        this.provider = provider;
    }

    async generateCommitMessage(diff: GitDiff, options?: CommitMessageOptions): Promise<string> {
        const opts = { ...this.defaultOptions, ...options };

        if (!this.provider) {
            return this.generateFallbackMessage(diff, opts);
        }

        const prompt = this.buildPrompt(diff, opts);

        try {
            const response = await this.provider.complete({
                messages: [
                    { role: 'system', content: this.getSystemPrompt(opts) },
                    { role: 'user', content: prompt }
                ],
                maxTokens: 500,
                temperature: 0.3
            });

            return this.cleanMessage(response.content, opts);
        } catch {
            return this.generateFallbackMessage(diff, opts);
        }
    }

    private getSystemPrompt(options: CommitMessageOptions): string {
        const typeInstructions = {
            conventional: `Generate a commit message following the Conventional Commits specification:
- Format: <type>(<scope>): <description>
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Keep the first line under ${options.maxLength} characters
- Use imperative mood ("add" not "added")`,
            simple: `Generate a simple, clear commit message:
- Keep it under ${options.maxLength} characters
- Use imperative mood
- Be concise but descriptive`,
            detailed: `Generate a detailed commit message:
- First line: brief summary under ${options.maxLength} characters
- Blank line
- Body: detailed explanation of changes
- Use bullet points for multiple changes`
        };

        return typeInstructions[options.type || 'conventional'];
    }

    private buildPrompt(diff: GitDiff, options: CommitMessageOptions): string {
        const lines: string[] = ['Generate a commit message for the following changes:'];
        lines.push('');
        lines.push(`Files changed: ${diff.stats.files}`);
        lines.push(`Additions: ${diff.stats.additions}, Deletions: ${diff.stats.deletions}`);
        lines.push('');
        lines.push('Changed files:');

        for (const file of diff.files) {
            lines.push(`- ${file.path} (${file.status}, +${file.additions}/-${file.deletions})`);
        }

        const filesWithDiff = diff.files.filter(f => f.diff);
        if (filesWithDiff.length > 0) {
            lines.push('');
            lines.push('Diff preview:');
            for (const file of filesWithDiff.slice(0, 3)) {
                lines.push(`\n--- ${file.path} ---`);
                lines.push(file.diff!.slice(0, 1000));
            }
        }

        if (options.language && options.language !== 'en') {
            lines.push('');
            lines.push(`Please write the commit message in ${options.language}.`);
        }

        return lines.join('\n');
    }

    private generateFallbackMessage(diff: GitDiff, options: CommitMessageOptions): string {
        const fileTypes = new Map<string, number>();
        
        for (const file of diff.files) {
            const ext = file.path.split('.').pop() || 'other';
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
        }

        const mainType = Array.from(fileTypes.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'files';

        let type = 'chore';
        let scope = '';

        if (diff.files.some(f => f.path.includes('test'))) {
            type = 'test';
        } else if (diff.files.some(f => f.path.endsWith('.md'))) {
            type = 'docs';
        } else if (diff.files.some(f => f.path.includes('config') || f.path.endsWith('.json'))) {
            type = 'chore';
            scope = 'config';
        } else if (mainType === 'ts' || mainType === 'js') {
            type = diff.stats.additions > diff.stats.deletions ? 'feat' : 'refactor';
        }

        const action = diff.files.length === 1 
            ? `update ${diff.files[0].path.split('/').pop()}`
            : `update ${diff.stats.files} files`;

        if (options.type === 'conventional') {
            return scope ? `${type}(${scope}): ${action}` : `${type}: ${action}`;
        }

        return action.charAt(0).toUpperCase() + action.slice(1);
    }

    private cleanMessage(message: string, options: CommitMessageOptions): string {
        let cleaned = message.trim();
        
        cleaned = cleaned.replace(/^```[\s\S]*?```$/gm, '');
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        cleaned = cleaned.trim();

        const lines = cleaned.split('\n');
        if (lines[0].length > options.maxLength!) {
            lines[0] = lines[0].slice(0, options.maxLength! - 3) + '...';
        }

        if (!options.includeBody && lines.length > 1) {
            return lines[0];
        }

        return lines.join('\n');
    }

    async generateFromStagedChanges(): Promise<string | undefined> {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showErrorMessage('Git extension not found');
            return undefined;
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git || git.repositories.length === 0) {
            vscode.window.showErrorMessage('No Git repository found');
            return undefined;
        }

        const repo = git.repositories[0];
        const stagedChanges = repo.state.indexChanges;

        if (stagedChanges.length === 0) {
            vscode.window.showWarningMessage('No staged changes found');
            return undefined;
        }

        const diff: GitDiff = {
            files: [],
            stats: { additions: 0, deletions: 0, files: stagedChanges.length }
        };

        for (const change of stagedChanges) {
            const status = this.mapGitStatus(change.status);
            diff.files.push({
                path: change.uri.fsPath,
                status,
                additions: 0,
                deletions: 0
            });
        }

        return this.generateCommitMessage(diff);
    }

    private mapGitStatus(status: number): DiffFile['status'] {
        switch (status) {
            case 1: return 'modified';
            case 2: return 'added';
            case 3: return 'deleted';
            case 4: return 'renamed';
            default: return 'modified';
        }
    }

    getConventionalTypes(): { type: string; description: string }[] {
        return [
            { type: 'feat', description: 'A new feature' },
            { type: 'fix', description: 'A bug fix' },
            { type: 'docs', description: 'Documentation only changes' },
            { type: 'style', description: 'Code style changes (formatting, etc)' },
            { type: 'refactor', description: 'Code refactoring' },
            { type: 'perf', description: 'Performance improvements' },
            { type: 'test', description: 'Adding or updating tests' },
            { type: 'build', description: 'Build system or dependencies' },
            { type: 'ci', description: 'CI configuration changes' },
            { type: 'chore', description: 'Other changes' }
        ];
    }
}
