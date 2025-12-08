import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { getAbsolutePath } from '../../utils/fileUtils';
import { createUnifiedDiff } from '../../utils/diff';

export class WriteFileTool extends BaseTool {
    name = 'write_file';
    description = 'Write content to a file in the workspace';

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path to the file to write (relative to workspace root)'
                    },
                    content: {
                        type: 'string',
                        description: 'The content to write to the file'
                    },
                    createDirectories: {
                        type: 'boolean',
                        description: 'Create parent directories if they do not exist'
                    }
                },
                required: ['path', 'content']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const filePath = input.path as string;
        const content = input.content as string;
        const createDirectories = input.createDirectories as boolean ?? true;

        if (!filePath) {
            return this.failure('File path is required');
        }

        if (content === undefined) {
            return this.failure('Content is required');
        }

        const absolutePath = getAbsolutePath(filePath);
        const dir = path.dirname(absolutePath);

        try {
            let oldContent = '';
            let isNewFile = true;

            try {
                oldContent = await fs.promises.readFile(absolutePath, 'utf-8');
                isNewFile = false;
            } catch {
                // File doesn't exist
            }

            if (createDirectories) {
                await fs.promises.mkdir(dir, { recursive: true });
            }

            await fs.promises.writeFile(absolutePath, content, 'utf-8');

            const uri = vscode.Uri.file(absolutePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });

            if (isNewFile) {
                return this.success(`Created new file: ${filePath}`);
            } else {
                const diff = createUnifiedDiff(filePath, filePath, oldContent, content);
                return this.success(
                    `Updated file: ${filePath}\n\nChanges:\n${diff}`,
                    { diff, oldContent, newContent: content }
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return this.failure(`Failed to write file: ${message}`);
        }
    }
}
