import * as vscode from 'vscode';
import * as path from 'path';

export interface WorkspaceInfo {
    name?: string;
    rootPath?: string;
    folders: WorkspaceFolder[];
    isMultiRoot: boolean;
}

export interface WorkspaceFolder {
    name: string;
    uri: string;
    index: number;
}

export interface FileInfo {
    name: string;
    path: string;
    relativePath: string;
    uri: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    modified?: number;
    language?: string;
}

export class WorkspaceIntegration implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private onFileChangeCallbacks: ((uri: vscode.Uri, type: 'create' | 'change' | 'delete') => void)[] = [];

    constructor() {
        this.setupWorkspaceListeners();
    }

    private setupWorkspaceListeners(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(e => {
                for (const folder of e.added) {
                    this.watchFolder(folder.uri.fsPath);
                }
                for (const folder of e.removed) {
                    this.unwatchFolder(folder.uri.fsPath);
                }
            })
        );

        for (const folder of vscode.workspace.workspaceFolders || []) {
            this.watchFolder(folder.uri.fsPath);
        }
    }

    private watchFolder(folderPath: string): void {
        if (this.fileWatchers.has(folderPath)) return;

        const pattern = new vscode.RelativePattern(folderPath, '**/*');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate(uri => this.notifyFileChange(uri, 'create'));
        watcher.onDidChange(uri => this.notifyFileChange(uri, 'change'));
        watcher.onDidDelete(uri => this.notifyFileChange(uri, 'delete'));

        this.fileWatchers.set(folderPath, watcher);
    }

    private unwatchFolder(folderPath: string): void {
        const watcher = this.fileWatchers.get(folderPath);
        if (watcher) {
            watcher.dispose();
            this.fileWatchers.delete(folderPath);
        }
    }

    private notifyFileChange(uri: vscode.Uri, type: 'create' | 'change' | 'delete'): void {
        for (const callback of this.onFileChangeCallbacks) {
            try {
                callback(uri, type);
            } catch {
                // Ignore callback errors
            }
        }
    }

    getWorkspaceInfo(): WorkspaceInfo {
        const folders = vscode.workspace.workspaceFolders || [];
        
        return {
            name: vscode.workspace.name,
            rootPath: folders[0]?.uri.fsPath,
            folders: folders.map((f, i) => ({
                name: f.name,
                uri: f.uri.toString(),
                index: i
            })),
            isMultiRoot: folders.length > 1
        };
    }

    getRootPath(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    getRelativePath(absolutePath: string): string {
        const rootPath = this.getRootPath();
        if (rootPath && absolutePath.startsWith(rootPath)) {
            return absolutePath.slice(rootPath.length + 1);
        }
        return absolutePath;
    }

    getAbsolutePath(relativePath: string): string {
        const rootPath = this.getRootPath();
        if (rootPath) {
            return path.join(rootPath, relativePath);
        }
        return relativePath;
    }

    async getFileInfo(filePath: string): Promise<FileInfo | undefined> {
        try {
            const uri = vscode.Uri.file(filePath);
            const stat = await vscode.workspace.fs.stat(uri);
            const name = path.basename(filePath);

            let type: FileInfo['type'] = 'file';
            if (stat.type === vscode.FileType.Directory) {
                type = 'directory';
            } else if (stat.type === vscode.FileType.SymbolicLink) {
                type = 'symlink';
            }

            let language: string | undefined;
            if (type === 'file') {
                const doc = await vscode.workspace.openTextDocument(uri);
                language = doc.languageId;
            }

            return {
                name,
                path: filePath,
                relativePath: this.getRelativePath(filePath),
                uri: uri.toString(),
                type,
                size: stat.size,
                modified: stat.mtime,
                language
            };
        } catch {
            return undefined;
        }
    }

    async listFiles(dirPath: string, recursive: boolean = false): Promise<FileInfo[]> {
        const files: FileInfo[] = [];
        const uri = vscode.Uri.file(dirPath);

        try {
            const entries = await vscode.workspace.fs.readDirectory(uri);

            for (const [name, type] of entries) {
                const filePath = path.join(dirPath, name);
                
                let fileType: FileInfo['type'] = 'file';
                if (type === vscode.FileType.Directory) {
                    fileType = 'directory';
                } else if (type === vscode.FileType.SymbolicLink) {
                    fileType = 'symlink';
                }

                files.push({
                    name,
                    path: filePath,
                    relativePath: this.getRelativePath(filePath),
                    uri: vscode.Uri.file(filePath).toString(),
                    type: fileType
                });

                if (recursive && type === vscode.FileType.Directory) {
                    const subFiles = await this.listFiles(filePath, true);
                    files.push(...subFiles);
                }
            }
        } catch {
            // Directory may not exist or be inaccessible
        }

        return files;
    }

    async readFile(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf-8');
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    }

    async deleteFile(filePath: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.delete(uri);
    }

    async createDirectory(dirPath: string): Promise<void> {
        const uri = vscode.Uri.file(dirPath);
        await vscode.workspace.fs.createDirectory(uri);
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    async findFiles(pattern: string, exclude?: string, maxResults?: number): Promise<vscode.Uri[]> {
        return vscode.workspace.findFiles(pattern, exclude, maxResults);
    }

    async searchInFiles(query: string, options?: {
        include?: string;
        exclude?: string;
        maxResults?: number;
        useRegex?: boolean;
        caseSensitive?: boolean;
    }): Promise<{ uri: vscode.Uri; line: number; text: string }[]> {
        const results: { uri: vscode.Uri; line: number; text: string }[] = [];
        const files = await this.findFiles(options?.include || '**/*', options?.exclude, options?.maxResults);

        const pattern = options?.useRegex 
            ? new RegExp(query, options?.caseSensitive ? 'g' : 'gi')
            : null;

        for (const uri of files) {
            try {
                const content = await this.readFile(uri.fsPath);
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const matches = pattern 
                        ? pattern.test(line)
                        : options?.caseSensitive 
                            ? line.includes(query)
                            : line.toLowerCase().includes(query.toLowerCase());

                    if (matches) {
                        results.push({ uri, line: i + 1, text: line.trim() });
                        if (options?.maxResults && results.length >= options.maxResults) {
                            return results;
                        }
                    }
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return results;
    }

    onFileChange(callback: (uri: vscode.Uri, type: 'create' | 'change' | 'delete') => void): vscode.Disposable {
        this.onFileChangeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onFileChangeCallbacks.indexOf(callback);
            if (index >= 0) this.onFileChangeCallbacks.splice(index, 1);
        });
    }

    async openFile(filePath: string, options?: {
        preview?: boolean;
        viewColumn?: vscode.ViewColumn;
        selection?: vscode.Range;
    }): Promise<vscode.TextEditor> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        return vscode.window.showTextDocument(document, {
            preview: options?.preview ?? true,
            viewColumn: options?.viewColumn,
            selection: options?.selection
        });
    }

    async saveAllFiles(): Promise<boolean> {
        return vscode.workspace.saveAll();
    }

    dispose(): void {
        for (const watcher of this.fileWatchers.values()) {
            watcher.dispose();
        }
        this.fileWatchers.clear();
        
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
        this.onFileChangeCallbacks = [];
    }
}
