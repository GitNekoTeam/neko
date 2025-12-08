import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseTool, ToolResult, ToolInput, ToolDefinition } from './BaseTool';

export class InsertContentTool extends BaseTool {
    public readonly name = 'insert_content';
    public readonly description = 'Insert content at a specific position in a file (start, end, or specific line).';

    public getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the file to modify (relative to workspace root)'
                    },
                    position: {
                        type: 'string',
                        description: 'Where to insert: start of file, end of file, or at specific line'
                    },
                    content: {
                        type: 'string',
                        description: 'The content to insert'
                    },
                    line: {
                        type: 'number',
                        description: 'Line number for insertion (required when position is "line", 1-indexed)'
                    },
                    createIfMissing: {
                        type: 'boolean',
                        description: 'Create the file if it does not exist'
                    }
                },
                required: ['path', 'position', 'content']
            }
        };
    }

    public async execute(input: ToolInput): Promise<ToolResult> {
        const filePath = input.path as string;
        const position = input.position as 'start' | 'end' | 'line';
        const content = input.content as string;
        const line = input.line as number | undefined;
        const createIfMissing = (input.createIfMissing as boolean) ?? false;

        try {
            const workspaceRoot = this.getWorkspaceRoot();
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceRoot, filePath);

            let existingContent = '';
            const fileExists = await this.fileExists(absolutePath);

            if (!fileExists) {
                if (createIfMissing) {
                    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                } else {
                    return this.failure(`File not found: ${filePath}`);
                }
            } else {
                existingContent = await fs.readFile(absolutePath, 'utf-8');
            }

            let newContent: string;

            switch (position) {
                case 'start':
                    newContent = content + (existingContent ? '\n' + existingContent : '');
                    break;

                case 'end':
                    newContent = existingContent + (existingContent && !existingContent.endsWith('\n') ? '\n' : '') + content;
                    break;

                case 'line':
                    if (line === undefined || line < 1) {
                        return this.failure('Line number is required and must be >= 1 when position is "line"');
                    }
                    newContent = this.insertAtLine(existingContent, content, line);
                    break;

                default:
                    return this.failure(`Invalid position: ${position}`);
            }

            await fs.writeFile(absolutePath, newContent, 'utf-8');

            const uri = vscode.Uri.file(absolutePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, { preview: false });

            const action = fileExists ? 'Inserted content' : 'Created file with content';
            return this.success(`${action} at ${position}${position === 'line' ? ` ${line}` : ''} in ${filePath}`);
        } catch (error) {
            return this.failure(`Failed to insert content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private insertAtLine(content: string, insertContent: string, lineNumber: number): string {
        const lines = content.split('\n');
        const insertIndex = Math.min(lineNumber - 1, lines.length);
        
        lines.splice(insertIndex, 0, insertContent);
        return lines.join('\n');
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private getWorkspaceRoot(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            throw new Error('No workspace folder open');
        }
        return folders[0].uri.fsPath;
    }
}
