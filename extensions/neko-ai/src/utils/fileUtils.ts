import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.vue': 'vue',
        '.svelte': 'svelte',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.xml': 'xml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'shellscript',
        '.bash': 'shellscript',
        '.zsh': 'shellscript',
        '.ps1': 'powershell',
        '.r': 'r',
        '.lua': 'lua',
        '.dart': 'dart',
        '.ex': 'elixir',
        '.exs': 'elixir',
        '.erl': 'erlang',
        '.hs': 'haskell',
        '.ml': 'ocaml',
        '.clj': 'clojure',
        '.lisp': 'lisp',
        '.vim': 'vim',
        '.dockerfile': 'dockerfile',
        '.tf': 'terraform',
        '.proto': 'protobuf'
    };
    return languageMap[ext] || 'plaintext';
}

export function isTextFile(filePath: string): boolean {
    const textExtensions = [
        '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
        '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue',
        '.svelte', '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml',
        '.xml', '.md', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.txt', '.log',
        '.env', '.gitignore', '.dockerignore', '.editorconfig', '.prettierrc',
        '.eslintrc', '.babelrc', '.npmrc', '.nvmrc'
    ];
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    return textExtensions.includes(ext) || 
           basename.startsWith('.') ||
           ['makefile', 'dockerfile', 'jenkinsfile', 'vagrantfile'].includes(basename);
}

export function isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
        '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
        '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
        '.woff', '.woff2', '.ttf', '.otf', '.eot',
        '.pyc', '.class', '.o', '.obj'
    ];
    return binaryExtensions.includes(path.extname(filePath).toLowerCase());
}

export async function readFileContent(filePath: string, maxSize: number = 100000): Promise<string | null> {
    try {
        const stat = await fs.promises.stat(filePath);
        if (stat.size > maxSize) {
            return null;
        }
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
        return null;
    }
}

export function getRelativePath(absolutePath: string, workspaceRoot?: string): string {
    const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root && absolutePath.startsWith(root)) {
        return path.relative(root, absolutePath);
    }
    return absolutePath;
}

export function getAbsolutePath(relativePath: string, workspaceRoot?: string): string {
    const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root && !path.isAbsolute(relativePath)) {
        return path.join(root, relativePath);
    }
    return relativePath;
}

export async function findFiles(
    pattern: string,
    exclude?: string,
    maxResults?: number
): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(pattern, exclude, maxResults);
}

export function getFileIcon(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const iconMap: Record<string, string> = {
        '.ts': 'typescript',
        '.js': 'javascript',
        '.py': 'python',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown'
    };
    return iconMap[ext] || 'file';
}
