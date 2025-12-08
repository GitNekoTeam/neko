import * as fs from 'fs';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { getAbsolutePath, isBinaryFile } from '../../utils/fileUtils';

export class ReadFileTool extends BaseTool {
    name = 'read_file';
    description = 'Read the contents of a file from the workspace';

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path to the file to read (relative to workspace root)'
                    },
                    startLine: {
                        type: 'number',
                        description: 'Optional start line number (1-indexed)'
                    },
                    endLine: {
                        type: 'number',
                        description: 'Optional end line number (1-indexed)'
                    }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const filePath = input.path as string;
        const startLine = input.startLine as number | undefined;
        const endLine = input.endLine as number | undefined;

        if (!filePath) {
            return this.failure('File path is required');
        }

        const absolutePath = getAbsolutePath(filePath);

        if (isBinaryFile(absolutePath)) {
            return this.failure('Cannot read binary file');
        }

        try {
            const stat = await fs.promises.stat(absolutePath);
            
            if (stat.size > 500000) {
                return this.failure('File is too large (>500KB)');
            }

            const content = await fs.promises.readFile(absolutePath, 'utf-8');
            
            if (startLine !== undefined || endLine !== undefined) {
                const lines = content.split('\n');
                const start = Math.max(0, (startLine || 1) - 1);
                const end = endLine ? Math.min(lines.length, endLine) : lines.length;
                const selectedLines = lines.slice(start, end);
                
                return this.success(
                    `File: ${filePath} (lines ${start + 1}-${end})\n\n${selectedLines.join('\n')}`,
                    { lines: selectedLines, totalLines: lines.length }
                );
            }

            return this.success(
                `File: ${filePath}\n\n${content}`,
                { content, size: stat.size }
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return this.failure(`Failed to read file: ${message}`);
        }
    }
}
