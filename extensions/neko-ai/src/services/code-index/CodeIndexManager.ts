import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';
import { v4 as uuidv4 } from 'uuid';

interface IndexedFile {
    id: string;
    path: string;
    content: string;
    embedding?: number[];
    lastModified: number;
}

interface SearchResult {
    file: string;
    content: string;
    score: number;
    startLine: number;
    endLine: number;
}

export class CodeIndexManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private indexedFiles: Map<string, IndexedFile> = new Map();
    private isIndexing = false;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private ignorePatterns: ReturnType<typeof ignore> | undefined;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.loadIndex();
        this.setupFileWatcher();
    }

    private async loadIndex(): Promise<void> {
        const stored = this.context.globalState.get<Record<string, IndexedFile>>('neko-ai.codeIndex');
        if (stored) {
            this.indexedFiles = new Map(Object.entries(stored));
            this.outputChannel.appendLine(`Loaded ${this.indexedFiles.size} indexed files from storage`);
        }
    }

    private async saveIndex(): Promise<void> {
        const obj = Object.fromEntries(this.indexedFiles);
        await this.context.globalState.update('neko-ai.codeIndex', obj);
    }

    private setupFileWatcher(): void {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        this.fileWatcher.onDidChange((uri: vscode.Uri) => this.onFileChanged(uri));
        this.fileWatcher.onDidCreate((uri: vscode.Uri) => this.onFileCreated(uri));
        this.fileWatcher.onDidDelete((uri: vscode.Uri) => this.onFileDeleted(uri));
    }

    private async onFileChanged(uri: vscode.Uri): Promise<void> {
        if (this.shouldIgnore(uri.fsPath)) return;
        await this.indexFile(uri.fsPath);
    }

    private async onFileCreated(uri: vscode.Uri): Promise<void> {
        if (this.shouldIgnore(uri.fsPath)) return;
        await this.indexFile(uri.fsPath);
    }

    private async onFileDeleted(uri: vscode.Uri): Promise<void> {
        const relativePath = this.getRelativePath(uri.fsPath);
        if (this.indexedFiles.has(relativePath)) {
            this.indexedFiles.delete(relativePath);
            await this.saveIndex();
        }
    }

    private shouldIgnore(filePath: string): boolean {
        const relativePath = this.getRelativePath(filePath);
        
        const defaultIgnore = [
            'node_modules', '.git', 'dist', 'build', 'out', '.next',
            '*.min.js', '*.min.css', '*.map', '*.lock', 'package-lock.json',
            '.env', '.env.*', '*.log', '*.tmp', '.DS_Store'
        ];

        for (const pattern of defaultIgnore) {
            if (relativePath.includes(pattern.replace('*', ''))) {
                return true;
            }
        }

        if (this.ignorePatterns) {
            return this.ignorePatterns.ignores(relativePath);
        }

        return false;
    }

    private getRelativePath(filePath: string): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.relative(workspaceFolder.uri.fsPath, filePath);
        }
        return filePath;
    }

    async indexWorkspace(workspacePath: string): Promise<void> {
        if (this.isIndexing) {
            this.outputChannel.appendLine('Indexing already in progress');
            return;
        }

        this.isIndexing = true;
        this.outputChannel.appendLine(`Starting workspace indexing: ${workspacePath}`);

        try {
            const gitignorePath = path.join(workspacePath, '.gitignore');
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                this.ignorePatterns = ignore().add(gitignoreContent);
            }

            const files = await this.getAllFiles(workspacePath);
            this.outputChannel.appendLine(`Found ${files.length} files to index`);

            let indexed = 0;
            for (const file of files) {
                await this.indexFile(file);
                indexed++;
                if (indexed % 100 === 0) {
                    this.outputChannel.appendLine(`Indexed ${indexed}/${files.length} files`);
                }
            }

            await this.saveIndex();
            this.outputChannel.appendLine(`Indexing complete: ${this.indexedFiles.size} files indexed`);
        } catch (error) {
            this.outputChannel.appendLine(`Indexing error: ${error}`);
        } finally {
            this.isIndexing = false;
        }
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (this.shouldIgnore(fullPath)) continue;

            if (entry.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile() && this.isCodeFile(entry.name)) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private isCodeFile(filename: string): boolean {
        const codeExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h',
            '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
            '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.json',
            '.yaml', '.yml', '.xml', '.md', '.sql', '.sh', '.bash', '.zsh'
        ];
        return codeExtensions.some(ext => filename.endsWith(ext));
    }

    private async indexFile(filePath: string): Promise<void> {
        try {
            const stat = await fs.promises.stat(filePath);
            const relativePath = this.getRelativePath(filePath);
            
            const existing = this.indexedFiles.get(relativePath);
            if (existing && existing.lastModified >= stat.mtimeMs) {
                return;
            }

            const content = await fs.promises.readFile(filePath, 'utf-8');
            
            if (content.length > 100000) {
                return;
            }

            this.indexedFiles.set(relativePath, {
                id: existing?.id || uuidv4(),
                path: relativePath,
                content,
                lastModified: stat.mtimeMs
            });
        } catch (error) {
            // Skip files that can't be read
        }
    }

    async search(query: string, limit = 10): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/);

        for (const [filePath, file] of this.indexedFiles) {
            const contentLower = file.content.toLowerCase();
            let score = 0;

            for (const term of queryTerms) {
                if (contentLower.includes(term)) {
                    score += (contentLower.match(new RegExp(term, 'g')) || []).length;
                }
                if (filePath.toLowerCase().includes(term)) {
                    score += 5;
                }
            }

            if (score > 0) {
                const lines = file.content.split('\n');
                let bestLineStart = 0;
                let bestLineScore = 0;

                for (let i = 0; i < lines.length; i++) {
                    const lineLower = lines[i].toLowerCase();
                    let lineScore = 0;
                    for (const term of queryTerms) {
                        if (lineLower.includes(term)) lineScore++;
                    }
                    if (lineScore > bestLineScore) {
                        bestLineScore = lineScore;
                        bestLineStart = i;
                    }
                }

                const startLine = Math.max(0, bestLineStart - 2);
                const endLine = Math.min(lines.length - 1, bestLineStart + 10);
                const snippet = lines.slice(startLine, endLine + 1).join('\n');

                results.push({
                    file: filePath,
                    content: snippet,
                    score,
                    startLine,
                    endLine
                });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    getFileContent(filePath: string): string | undefined {
        return this.indexedFiles.get(filePath)?.content;
    }

    getIndexedFileCount(): number {
        return this.indexedFiles.size;
    }

    dispose(): void {
        this.fileWatcher?.dispose();
    }
}
