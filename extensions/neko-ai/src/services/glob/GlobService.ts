import * as path from 'path';
import * as fs from 'fs/promises';
import ignore from 'ignore';

type Ignore = ReturnType<typeof ignore>;

export const DIRS_TO_IGNORE = [
    'node_modules',
    '.git',
    '__pycache__',
    'venv',
    'env',
    '.venv',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '.idea',
    '.vscode',
    '.*'
];

export interface ListFilesOptions {
    recursive?: boolean;
    limit?: number;
    includeHidden?: boolean;
}

export interface GlobServiceOptions {
    workspacePath: string;
}

export class GlobService {
    private workspacePath: string;
    private ignoreInstance: Ignore | null = null;

    constructor(options: GlobServiceOptions) {
        this.workspacePath = options.workspacePath;
    }

    async listFiles(
        dirPath: string,
        options: ListFilesOptions = {}
    ): Promise<[string[], boolean]> {
        const { recursive = false, limit = 1000, includeHidden = false } = options;

        if (limit === 0) {
            return [[], false];
        }

        const absolutePath = path.resolve(this.workspacePath, dirPath);
        const ignoreInstance = await this.createIgnoreInstance(absolutePath);

        const files: string[] = [];
        const directories: string[] = [];

        await this.scanDirectory(
            absolutePath,
            files,
            directories,
            ignoreInstance,
            recursive,
            includeHidden,
            limit
        );

        const allPaths = [...directories, ...files];
        const uniquePaths = [...new Set(allPaths)];

        uniquePaths.sort((a, b) => {
            const aIsDir = a.endsWith('/');
            const bIsDir = b.endsWith('/');
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        const trimmedPaths = uniquePaths.slice(0, limit);
        return [trimmedPaths, trimmedPaths.length >= limit];
    }

    private async scanDirectory(
        dirPath: string,
        files: string[],
        directories: string[],
        ignoreInstance: Ignore,
        recursive: boolean,
        includeHidden: boolean,
        limit: number
    ): Promise<void> {
        if (files.length + directories.length >= limit) {
            return;
        }

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length + directories.length >= limit) {
                    break;
                }

                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(this.workspacePath, fullPath);

                if (!includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                if (this.shouldIgnore(entry.name, relativePath, ignoreInstance)) {
                    continue;
                }

                if (entry.isDirectory() && !entry.isSymbolicLink()) {
                    directories.push(fullPath + '/');

                    if (recursive) {
                        await this.scanDirectory(
                            fullPath,
                            files,
                            directories,
                            ignoreInstance,
                            recursive,
                            includeHidden,
                            limit
                        );
                    }
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`Could not read directory ${dirPath}:`, error);
        }
    }

    private shouldIgnore(
        name: string,
        relativePath: string,
        ignoreInstance: Ignore
    ): boolean {
        if (DIRS_TO_IGNORE.includes(name)) {
            return true;
        }

        const normalizedPath = relativePath.replace(/\\/g, '/');
        return ignoreInstance.ignores(normalizedPath);
    }

    private async createIgnoreInstance(dirPath: string): Promise<Ignore> {
        const ignoreInstance = ignore();

        const gitignoreFiles = await this.findGitignoreFiles(dirPath);

        for (const gitignoreFile of gitignoreFiles) {
            try {
                const content = await fs.readFile(gitignoreFile, 'utf8');
                ignoreInstance.add(content);
            } catch (error) {
                console.warn(`Could not read .gitignore at ${gitignoreFile}:`, error);
            }
        }

        return ignoreInstance;
    }

    private async findGitignoreFiles(startPath: string): Promise<string[]> {
        const gitignoreFiles: string[] = [];
        let currentPath = startPath;

        while (currentPath && currentPath !== path.dirname(currentPath)) {
            const gitignorePath = path.join(currentPath, '.gitignore');

            try {
                await fs.access(gitignorePath);
                gitignoreFiles.push(gitignorePath);
            } catch {
                // .gitignore doesn't exist at this level
            }

            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                break;
            }
            currentPath = parentPath;
        }

        return gitignoreFiles.reverse();
    }

    async searchFiles(
        pattern: string,
        options: { maxResults?: number; includeHidden?: boolean } = {}
    ): Promise<string[]> {
        const { maxResults = 100, includeHidden = false } = options;
        const [files] = await this.listFiles('.', {
            recursive: true,
            limit: 10000,
            includeHidden
        });

        const regex = new RegExp(pattern, 'i');
        const matches = files.filter(file => regex.test(path.basename(file)));

        return matches.slice(0, maxResults);
    }

    matchesGlob(filePath: string, pattern: string): boolean {
        const regex = this.globToRegex(pattern);
        return regex.test(filePath);
    }

    private globToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`, 'i');
    }
}
