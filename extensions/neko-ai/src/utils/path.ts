import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

function toPosixPath(p: string): string {
    const isExtendedLengthPath = p.startsWith('\\\\?\\');
    if (isExtendedLengthPath) {
        return p;
    }
    return p.replace(/\\/g, '/');
}

declare global {
    interface String {
        toPosix(): string;
    }
}

String.prototype.toPosix = function(this: string): string {
    return toPosixPath(this);
};

export function arePathsEqual(path1?: string, path2?: string): boolean {
    if (!path1 && !path2) {
        return true;
    }
    if (!path1 || !path2) {
        return false;
    }

    path1 = normalizePath(path1);
    path2 = normalizePath(path2);

    if (process.platform === 'win32') {
        return path1.toLowerCase() === path2.toLowerCase();
    }
    return path1 === path2;
}

function normalizePath(p: string): string {
    let normalized = path.normalize(p);
    if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

export function getReadablePath(cwd: string, relPath?: string): string {
    relPath = relPath || '';
    const absolutePath = path.resolve(cwd, relPath);

    if (arePathsEqual(cwd, path.join(os.homedir(), 'Desktop'))) {
        return absolutePath.toPosix();
    }

    if (arePathsEqual(path.normalize(absolutePath), path.normalize(cwd))) {
        return path.basename(absolutePath).toPosix();
    }

    const normalizedRelPath = path.relative(cwd, absolutePath);
    if (absolutePath.includes(cwd)) {
        return normalizedRelPath.toPosix();
    }

    return absolutePath.toPosix();
}

export function toRelativePath(filePath: string, cwd: string): string {
    const relativePath = path.relative(cwd, filePath).toPosix();
    return filePath.endsWith('/') ? relativePath + '/' : relativePath;
}

export function getWorkspacePath(defaultCwdPath = ''): string {
    const cwdPath = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath).at(0) || defaultCwdPath;
    const currentFileUri = vscode.window.activeTextEditor?.document.uri;

    if (currentFileUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
        return workspaceFolder?.uri.fsPath || cwdPath;
    }

    return cwdPath;
}

export function getWorkspacePathForContext(contextPath?: string): string {
    if (contextPath) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(contextPath));
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
    }
    return getWorkspacePath();
}

export function isAbsolutePath(p: string): boolean {
    return path.isAbsolute(p);
}

export function joinPath(...paths: string[]): string {
    return path.join(...paths);
}

export function getBasename(p: string): string {
    return path.basename(p);
}

export function getDirname(p: string): string {
    return path.dirname(p);
}

export function getExtname(p: string): string {
    return path.extname(p);
}
