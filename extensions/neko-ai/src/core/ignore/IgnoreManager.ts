import * as vscode from 'vscode';
import * as path from 'path';

export interface IgnorePattern {
    pattern: string;
    source: 'gitignore' | 'nekoignore' | 'config' | 'default';
    isNegation: boolean;
}

export class IgnoreManager {
    private patterns: IgnorePattern[] = [];
    private workspaceRoot: string;
    private defaultPatterns: string[] = [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        'dist',
        'build',
        'out',
        '.next',
        '.nuxt',
        '__pycache__',
        '*.pyc',
        '.venv',
        'venv',
        'env',
        '.env',
        '.env.local',
        '*.log',
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.DS_Store',
        'Thumbs.db',
        '*.min.js',
        '*.min.css',
        '*.map',
        'coverage',
        '.nyc_output',
        '.cache',
        '.parcel-cache',
        '.turbo',
        '*.sqlite',
        '*.db'
    ];

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.loadDefaultPatterns();
    }

    private loadDefaultPatterns(): void {
        for (const pattern of this.defaultPatterns) {
            this.patterns.push({
                pattern,
                source: 'default',
                isNegation: false
            });
        }
    }

    async loadGitignore(): Promise<void> {
        if (!this.workspaceRoot) return;

        try {
            const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
            const uri = vscode.Uri.file(gitignorePath);
            const content = await vscode.workspace.fs.readFile(uri);
            const lines = Buffer.from(content).toString('utf-8').split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const isNegation = trimmed.startsWith('!');
                    const pattern = isNegation ? trimmed.slice(1) : trimmed;
                    this.patterns.push({
                        pattern,
                        source: 'gitignore',
                        isNegation
                    });
                }
            }
        } catch {
            // .gitignore doesn't exist
        }
    }

    async loadNekoignore(): Promise<void> {
        if (!this.workspaceRoot) return;

        try {
            const nekoignorePath = path.join(this.workspaceRoot, '.nekoignore');
            const uri = vscode.Uri.file(nekoignorePath);
            const content = await vscode.workspace.fs.readFile(uri);
            const lines = Buffer.from(content).toString('utf-8').split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const isNegation = trimmed.startsWith('!');
                    const pattern = isNegation ? trimmed.slice(1) : trimmed;
                    this.patterns.push({
                        pattern,
                        source: 'nekoignore',
                        isNegation
                    });
                }
            }
        } catch {
            // .nekoignore doesn't exist
        }
    }

    addPattern(pattern: string, source: IgnorePattern['source'] = 'config'): void {
        const isNegation = pattern.startsWith('!');
        const cleanPattern = isNegation ? pattern.slice(1) : pattern;
        this.patterns.push({
            pattern: cleanPattern,
            source,
            isNegation
        });
    }

    removePattern(pattern: string): void {
        this.patterns = this.patterns.filter(p => p.pattern !== pattern);
    }

    shouldIgnore(filePath: string): boolean {
        const relativePath = this.getRelativePath(filePath);
        let ignored = false;

        for (const { pattern, isNegation } of this.patterns) {
            if (this.matchPattern(relativePath, pattern)) {
                ignored = !isNegation;
            }
        }

        return ignored;
    }

    private getRelativePath(filePath: string): string {
        if (this.workspaceRoot && filePath.startsWith(this.workspaceRoot)) {
            return filePath.slice(this.workspaceRoot.length + 1);
        }
        return filePath;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        if (normalizedPattern.includes('/')) {
            return this.matchGlob(normalizedPath, normalizedPattern);
        }

        const parts = normalizedPath.split('/');
        for (const part of parts) {
            if (this.matchGlob(part, normalizedPattern)) {
                return true;
            }
        }

        return this.matchGlob(normalizedPath, normalizedPattern);
    }

    private matchGlob(str: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(str);
    }

    filterPaths(paths: string[]): string[] {
        return paths.filter(p => !this.shouldIgnore(p));
    }

    getPatterns(): IgnorePattern[] {
        return [...this.patterns];
    }

    getPatternsBySource(source: IgnorePattern['source']): string[] {
        return this.patterns
            .filter(p => p.source === source)
            .map(p => p.isNegation ? `!${p.pattern}` : p.pattern);
    }

    async createNekoignore(): Promise<void> {
        if (!this.workspaceRoot) return;

        const content = `# Neko AI Ignore File
# Files and folders listed here will be ignored by Neko AI

# Dependencies
node_modules/
.venv/
venv/

# Build outputs
dist/
build/
out/

# IDE
.idea/
.vscode/

# Logs
*.log

# Environment files
.env
.env.local
.env.*.local

# Add your custom patterns below
`;

        const uri = vscode.Uri.file(path.join(this.workspaceRoot, '.nekoignore'));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    }

    clear(): void {
        this.patterns = [];
        this.loadDefaultPatterns();
    }

    async reload(): Promise<void> {
        this.clear();
        await this.loadGitignore();
        await this.loadNekoignore();
    }
}
