import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileDropData {
    type: 'file' | 'folder' | 'image' | 'text';
    path: string;
    content?: string;
    mimeType?: string;
}

export interface ImageData {
    base64: string;
    mimeType: string;
    width?: number;
    height?: number;
}

export class MiscIntegration {
    async handleFileDrop(uris: vscode.Uri[]): Promise<FileDropData[]> {
        const results: FileDropData[] = [];

        for (const uri of uris) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);

                if (stat.type === vscode.FileType.Directory) {
                    results.push({
                        type: 'folder',
                        path: uri.fsPath
                    });
                } else if (stat.type === vscode.FileType.File) {
                    const ext = path.extname(uri.fsPath).toLowerCase();
                    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);

                    if (isImage) {
                        const imageData = await this.readImageFile(uri.fsPath);
                        results.push({
                            type: 'image',
                            path: uri.fsPath,
                            content: imageData.base64,
                            mimeType: imageData.mimeType
                        });
                    } else {
                        const content = await this.readTextFile(uri.fsPath);
                        results.push({
                            type: 'file',
                            path: uri.fsPath,
                            content
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to process dropped file ${uri.fsPath}:`, error);
            }
        }

        return results;
    }

    async handleTextDrop(text: string): Promise<FileDropData> {
        return {
            type: 'text',
            path: '',
            content: text
        };
    }

    async readTextFile(filePath: string): Promise<string> {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    }

    async readImageFile(filePath: string): Promise<ImageData> {
        const buffer = await fs.readFile(filePath);
        const base64 = buffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase();

        const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        };

        return {
            base64,
            mimeType: mimeTypes[ext] || 'image/png'
        };
    }

    async exportToMarkdown(
        messages: Array<{ role: string; content: string; timestamp?: number }>,
        outputPath: string
    ): Promise<void> {
        let markdown = '# Chat Export\n\n';
        markdown += `Exported at: ${new Date().toISOString()}\n\n`;
        markdown += '---\n\n';

        for (const message of messages) {
            const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
            const timestamp = message.timestamp
                ? new Date(message.timestamp).toLocaleString()
                : '';

            markdown += `## ${role}${timestamp ? ` (${timestamp})` : ''}\n\n`;
            markdown += `${message.content}\n\n`;
            markdown += '---\n\n';
        }

        await fs.writeFile(outputPath, markdown, 'utf-8');
    }

    async openFile(filePath: string, options?: { preview?: boolean; viewColumn?: vscode.ViewColumn }): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
            preview: options?.preview ?? true,
            viewColumn: options?.viewColumn
        });
    }

    async openFileAtLine(filePath: string, line: number, column?: number): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(line - 1, (column || 1) - 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }

    async getSelectedText(): Promise<string | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            return null;
        }

        return editor.document.getText(selection);
    }

    async insertTextAtCursor(text: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return false;
        }

        await editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, text);
        });

        return true;
    }

    async replaceSelection(text: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return false;
        }

        await editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, text);
        });

        return true;
    }

    async copyToClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }

    async readFromClipboard(): Promise<string> {
        return vscode.env.clipboard.readText();
    }

    countLines(content: string): number {
        return content.split('\n').length;
    }

    getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }

    getFileName(filePath: string): string {
        return path.basename(filePath);
    }

    getLanguageId(filePath: string): string {
        const ext = this.getFileExtension(filePath);
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.sql': 'sql',
            '.sh': 'shellscript',
            '.bash': 'shellscript',
            '.zsh': 'shellscript',
            '.ps1': 'powershell',
            '.vue': 'vue',
            '.svelte': 'svelte'
        };

        return languageMap[ext] || 'plaintext';
    }
}
