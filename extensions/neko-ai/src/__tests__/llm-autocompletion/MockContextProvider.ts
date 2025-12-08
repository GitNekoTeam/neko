import { ContextItem } from './types';

export interface MockFile {
    path: string;
    content: string;
    language: string;
}

export interface MockWorkspace {
    files: MockFile[];
    rootPath: string;
}

export class MockContextProvider {
    private workspace: MockWorkspace;
    private openFiles: Map<string, MockFile> = new Map();
    private cursorPosition: { file: string; line: number; column: number } | null = null;

    constructor(workspace?: MockWorkspace) {
        this.workspace = workspace || { files: [], rootPath: '/mock/workspace' };
    }

    setWorkspace(workspace: MockWorkspace): void {
        this.workspace = workspace;
    }

    addFile(file: MockFile): void {
        this.workspace.files.push(file);
    }

    removeFile(path: string): void {
        this.workspace.files = this.workspace.files.filter(f => f.path !== path);
        this.openFiles.delete(path);
    }

    openFile(path: string): MockFile | null {
        const file = this.workspace.files.find(f => f.path === path);
        if (file) {
            this.openFiles.set(path, file);
        }
        return file || null;
    }

    closeFile(path: string): void {
        this.openFiles.delete(path);
    }

    setCursorPosition(file: string, line: number, column: number): void {
        this.cursorPosition = { file, line, column };
    }

    getContextAtCursor(): { prefix: string; suffix: string; language: string } | null {
        if (!this.cursorPosition) {
            return null;
        }

        const file = this.openFiles.get(this.cursorPosition.file);
        if (!file) {
            return null;
        }

        const lines = file.content.split('\n');
        const { line, column } = this.cursorPosition;

        if (line < 0 || line >= lines.length) {
            return null;
        }

        const prefixLines = lines.slice(0, line);
        const currentLine = lines[line];
        const prefixCurrentLine = currentLine.substring(0, column);
        const suffixCurrentLine = currentLine.substring(column);
        const suffixLines = lines.slice(line + 1);

        const prefix = [...prefixLines, prefixCurrentLine].join('\n');
        const suffix = [suffixCurrentLine, ...suffixLines].join('\n');

        return { prefix, suffix, language: file.language };
    }

    getRelatedFiles(currentPath: string, maxFiles: number = 5): ContextItem[] {
        const currentFile = this.workspace.files.find(f => f.path === currentPath);
        if (!currentFile) {
            return [];
        }

        const relatedFiles = this.workspace.files
            .filter(f => f.path !== currentPath && f.language === currentFile.language)
            .slice(0, maxFiles);

        return relatedFiles.map(f => ({
            type: 'file' as const,
            content: f.content,
            path: f.path,
            language: f.language
        }));
    }

    getDefinitions(symbol: string): ContextItem[] {
        const definitions: ContextItem[] = [];

        for (const file of this.workspace.files) {
            const regex = new RegExp(
                `(function|class|const|let|var|interface|type)\\s+${symbol}\\b`,
                'g'
            );

            const matches = file.content.match(regex);
            if (matches) {
                const lines = file.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i])) {
                        const startLine = Math.max(0, i - 2);
                        const endLine = Math.min(lines.length, i + 10);
                        const snippet = lines.slice(startLine, endLine).join('\n');

                        definitions.push({
                            type: 'definition',
                            content: snippet,
                            path: file.path,
                            language: file.language
                        });
                    }
                }
            }
        }

        return definitions;
    }

    getImports(filePath: string): string[] {
        const file = this.workspace.files.find(f => f.path === filePath);
        if (!file) {
            return [];
        }

        const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
        const imports: string[] = [];
        let match;

        while ((match = importRegex.exec(file.content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    getExports(filePath: string): string[] {
        const file = this.workspace.files.find(f => f.path === filePath);
        if (!file) {
            return [];
        }

        const exportRegex = /export\s+(const|let|var|function|class|interface|type)\s+(\w+)/g;
        const exports: string[] = [];
        let match;

        while ((match = exportRegex.exec(file.content)) !== null) {
            exports.push(match[2]);
        }

        return exports;
    }

    getAllFiles(): MockFile[] {
        return [...this.workspace.files];
    }

    getOpenFiles(): MockFile[] {
        return Array.from(this.openFiles.values());
    }

    getRootPath(): string {
        return this.workspace.rootPath;
    }
}
