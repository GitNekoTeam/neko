import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseTool, ToolResult, ToolInput, ToolDefinition } from './BaseTool';

export class NewFileTool extends BaseTool {
    public readonly name = 'new_file';
    public readonly description = 'Create a new file with optional content. Creates parent directories if needed.';

    public getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the file to create (relative to workspace root)'
                    },
                    content: {
                        type: 'string',
                        description: 'Initial content for the file'
                    },
                    overwrite: {
                        type: 'boolean',
                        description: 'Overwrite if file exists (default: false)'
                    },
                    openAfterCreate: {
                        type: 'boolean',
                        description: 'Open the file in editor after creation (default: true)'
                    }
                },
                required: ['path']
            }
        };
    }

    public async execute(input: ToolInput): Promise<ToolResult> {
        const filePath = input.path as string;
        const content = (input.content as string) ?? '';
        const overwrite = (input.overwrite as boolean) ?? false;
        const openAfterCreate = (input.openAfterCreate as boolean) ?? true;

        try {
            const workspaceRoot = this.getWorkspaceRoot();
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceRoot, filePath);

            const fileExists = await this.fileExists(absolutePath);
            if (fileExists && !overwrite) {
                return this.failure(`File already exists: ${filePath}. Use overwrite: true to replace.`);
            }

            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, content, 'utf-8');

            if (openAfterCreate) {
                const uri = vscode.Uri.file(absolutePath);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document, { preview: false });
            }

            const action = fileExists ? 'Overwrote' : 'Created';
            return this.success(`${action} file: ${filePath}`, {
                path: filePath,
                absolutePath,
                overwritten: fileExists,
                contentLength: content.length
            });
        } catch (error) {
            return this.failure(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
