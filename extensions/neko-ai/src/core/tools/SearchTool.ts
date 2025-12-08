import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { CodeIndexManager } from '../../services/code-index/CodeIndexManager';

export class SearchTool extends BaseTool {
    name = 'search_codebase';
    description = 'Search the codebase for relevant code snippets using semantic search';

    private codeIndexManager: CodeIndexManager;

    constructor(outputChannel: vscode.OutputChannel, codeIndexManager: CodeIndexManager) {
        super(outputChannel);
        this.codeIndexManager = codeIndexManager;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results (default: 10)'
                    }
                },
                required: ['query']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const query = input.query as string;
        const limit = (input.limit as number) || 10;

        if (!query) {
            return this.failure('Search query is required');
        }

        try {
            const results = await this.codeIndexManager.search(query, limit);

            if (results.length === 0) {
                return this.success('No results found for the query.');
            }

            let output = `Found ${results.length} results for "${query}":\n\n`;

            for (const result of results) {
                output += `--- ${result.file} (lines ${result.startLine}-${result.endLine}, score: ${result.score.toFixed(2)}) ---\n`;
                output += result.content + '\n\n';
            }

            return this.success(output, { results });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return this.failure(`Search failed: ${message}`);
        }
    }
}

export class GrepTool extends BaseTool {
    name = 'grep_search';
    description = 'Search for a pattern in files using regex';

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'The regex pattern to search for'
                    },
                    include: {
                        type: 'string',
                        description: 'Glob pattern for files to include (e.g., "**/*.ts")'
                    },
                    exclude: {
                        type: 'string',
                        description: 'Glob pattern for files to exclude'
                    },
                    caseSensitive: {
                        type: 'boolean',
                        description: 'Whether the search is case sensitive'
                    }
                },
                required: ['pattern']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const pattern = input.pattern as string;
        const include = input.include as string || '**/*';
        const exclude = input.exclude as string || '**/node_modules/**';
        const caseSensitive = input.caseSensitive as boolean ?? false;

        if (!pattern) {
            return this.failure('Search pattern is required');
        }

        try {
            const results: { file: string; line: number; text: string }[] = [];
            const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

            const files = await vscode.workspace.findFiles(include, exclude, 1000);

            for (const file of files) {
                try {
                    const doc = await vscode.workspace.openTextDocument(file);
                    const text = doc.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        if (regex.test(lines[i])) {
                            results.push({
                                file: vscode.workspace.asRelativePath(file),
                                line: i + 1,
                                text: lines[i].trim()
                            });
                            if (results.length >= 100) break;
                        }
                        regex.lastIndex = 0;
                    }
                } catch {
                    // Skip files that can't be read
                }

                if (results.length >= 100) break;
            }

            if (results.length === 0) {
                return this.success(`No matches found for pattern: ${pattern}`);
            }

            let output = `Found ${results.length} matches for "${pattern}":\n\n`;
            for (const result of results) {
                output += `${result.file}:${result.line}: ${result.text}\n`;
            }

            return this.success(output, { results });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return this.failure(`Search failed: ${message}`);
        }
    }
}
