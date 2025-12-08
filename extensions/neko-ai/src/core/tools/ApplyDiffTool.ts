import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BaseTool, ToolResult, ToolInput, ToolDefinition } from './BaseTool';

interface DiffBlock {
    search: string;
    replace: string;
}

export class ApplyDiffTool extends BaseTool {
    public readonly name = 'apply_diff';
    public readonly description = 'Apply a diff to a file using SEARCH/REPLACE blocks. Supports multiple changes in one operation.';

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
                    diff: {
                        type: 'string',
                        description: 'The diff content containing SEARCH and REPLACE blocks'
                    }
                },
                required: ['path', 'diff']
            }
        };
    }

    public async execute(input: ToolInput): Promise<ToolResult> {
        const filePath = input.path as string;
        const diff = input.diff as string;

        try {
            const workspaceRoot = this.getWorkspaceRoot();
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceRoot, filePath);

            const fileExists = await this.fileExists(absolutePath);
            if (!fileExists) {
                return this.failure(`File not found: ${filePath}`);
            }

            const originalContent = await fs.readFile(absolutePath, 'utf-8');
            const diffBlocks = this.parseDiffBlocks(diff);

            if (diffBlocks.length === 0) {
                return this.failure('No valid SEARCH/REPLACE blocks found in diff');
            }

            let modifiedContent = originalContent;
            const appliedChanges: string[] = [];
            const failedChanges: string[] = [];

            for (let i = 0; i < diffBlocks.length; i++) {
                const block = diffBlocks[i];
                const result = this.applyBlock(modifiedContent, block);

                if (result.success) {
                    modifiedContent = result.content;
                    appliedChanges.push(`Block ${i + 1}: Applied successfully`);
                } else {
                    const fuzzyResult = this.fuzzyApplyBlock(modifiedContent, block);
                    if (fuzzyResult.success) {
                        modifiedContent = fuzzyResult.content;
                        appliedChanges.push(`Block ${i + 1}: Applied with fuzzy matching (${fuzzyResult.matchType})`);
                    } else {
                        failedChanges.push(`Block ${i + 1}: ${result.error}`);
                    }
                }
            }

            if (appliedChanges.length === 0) {
                return this.failure(`Failed to apply any changes:\n${failedChanges.join('\n')}`);
            }

            await fs.writeFile(absolutePath, modifiedContent, 'utf-8');

            const uri = vscode.Uri.file(absolutePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, { preview: false });

            let message = `Applied ${appliedChanges.length}/${diffBlocks.length} changes to ${filePath}`;
            if (failedChanges.length > 0) {
                message += `\n\nFailed changes:\n${failedChanges.join('\n')}`;
            }

            return this.success(message);
        } catch (error) {
            return this.failure(`Failed to apply diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseDiffBlocks(diff: string): DiffBlock[] {
        const blocks: DiffBlock[] = [];
        const patterns = [
            /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g,
            /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g,
            /-{3,}\s*SEARCH\s*-{3,}\n([\s\S]*?)\n-{3,}\s*REPLACE\s*-{3,}\n([\s\S]*?)(?=\n-{3,}\s*SEARCH|\n*$)/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(diff)) !== null) {
                blocks.push({
                    search: match[1],
                    replace: match[2]
                });
            }
            if (blocks.length > 0) break;
        }

        return blocks;
    }

    private applyBlock(content: string, block: DiffBlock): { success: boolean; content: string; error?: string } {
        const searchNormalized = this.normalizeLineEndings(block.search);
        const contentNormalized = this.normalizeLineEndings(content);

        if (!contentNormalized.includes(searchNormalized)) {
            return { 
                success: false, 
                content, 
                error: 'Search text not found in file' 
            };
        }

        const occurrences = contentNormalized.split(searchNormalized).length - 1;
        if (occurrences > 1) {
            return { 
                success: false, 
                content, 
                error: `Search text found ${occurrences} times, expected exactly 1` 
            };
        }

        const newContent = contentNormalized.replace(searchNormalized, block.replace);
        return { success: true, content: newContent };
    }

    private fuzzyApplyBlock(content: string, block: DiffBlock): { success: boolean; content: string; matchType?: string } {
        const searchLines = block.search.split('\n').map(l => l.trim()).filter(l => l);
        const contentLines = content.split('\n');

        let bestMatch = { start: -1, end: -1, score: 0 };

        for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
            let matchScore = 0;
            for (let j = 0; j < searchLines.length; j++) {
                const contentLine = contentLines[i + j].trim();
                const searchLine = searchLines[j];
                
                if (contentLine === searchLine) {
                    matchScore += 2;
                } else if (contentLine.includes(searchLine) || searchLine.includes(contentLine)) {
                    matchScore += 1;
                }
            }

            const normalizedScore = matchScore / (searchLines.length * 2);
            if (normalizedScore > bestMatch.score && normalizedScore >= 0.7) {
                bestMatch = { start: i, end: i + searchLines.length, score: normalizedScore };
            }
        }

        if (bestMatch.start === -1) {
            return { success: false, content };
        }

        const replaceLines = block.replace.split('\n');
        const originalIndent = this.getIndent(contentLines[bestMatch.start]);
        const adjustedReplaceLines = replaceLines.map(line => {
            if (line.trim() === '') return line;
            return originalIndent + line.trimStart();
        });

        const newLines = [
            ...contentLines.slice(0, bestMatch.start),
            ...adjustedReplaceLines,
            ...contentLines.slice(bestMatch.end)
        ];

        return { 
            success: true, 
            content: newLines.join('\n'),
            matchType: `${Math.round(bestMatch.score * 100)}% match`
        };
    }

    private normalizeLineEndings(text: string): string {
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    private getIndent(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
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
