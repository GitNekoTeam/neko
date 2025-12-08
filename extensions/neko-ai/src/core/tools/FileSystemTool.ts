import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';

export class ListDirectoryTool extends BaseTool {
    name = 'list_directory';
    description = 'List contents of a directory with file types and sizes';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Directory path to list' },
                    recursive: { type: 'boolean', description: 'List recursively (default: false)' },
                    maxDepth: { type: 'number', description: 'Max depth for recursive listing (default: 1)' }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const dirPath = input.path as string;
            const recursive = input.recursive as boolean || false;
            const maxDepth = input.maxDepth as number || 1;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(dirPath) 
                ? dirPath 
                : path.join(workspaceFolders[0].uri.fsPath, dirPath);

            const uri = vscode.Uri.file(fullPath);
            const entries = await this.listDir(uri, recursive, maxDepth, 0);

            return this.success(entries.join('\n'), { entries });
        } catch (error) {
            return this.failure(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async listDir(uri: vscode.Uri, recursive: boolean, maxDepth: number, currentDepth: number): Promise<string[]> {
        const entries: string[] = [];
        const items = await vscode.workspace.fs.readDirectory(uri);
        const indent = '  '.repeat(currentDepth);

        for (const [name, type] of items) {
            const itemUri = vscode.Uri.joinPath(uri, name);
            const typeStr = type === vscode.FileType.Directory ? '[DIR]' : '[FILE]';
            
            if (type === vscode.FileType.File) {
                try {
                    const stat = await vscode.workspace.fs.stat(itemUri);
                    const sizeStr = this.formatSize(stat.size);
                    entries.push(`${indent}${typeStr} ${name} (${sizeStr})`);
                } catch {
                    entries.push(`${indent}${typeStr} ${name}`);
                }
            } else {
                entries.push(`${indent}${typeStr} ${name}/`);
                
                if (recursive && currentDepth < maxDepth) {
                    const subEntries = await this.listDir(itemUri, recursive, maxDepth, currentDepth + 1);
                    entries.push(...subEntries);
                }
            }
        }

        return entries;
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }
}

export class GetDirectoryTreeTool extends BaseTool {
    name = 'get_directory_tree';
    description = 'Get a tree view of the directory structure';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Root directory path' },
                    maxDepth: { type: 'number', description: 'Maximum depth to traverse (default: 3)' },
                    includeFiles: { type: 'boolean', description: 'Include files in tree (default: true)' }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const dirPath = input.path as string;
            const maxDepth = input.maxDepth as number || 3;
            const includeFiles = input.includeFiles !== false;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(dirPath) 
                ? dirPath 
                : path.join(workspaceFolders[0].uri.fsPath, dirPath);

            const uri = vscode.Uri.file(fullPath);
            const tree = await this.buildTree(uri, maxDepth, includeFiles, 0, '');

            return this.success(tree, { tree });
        } catch (error) {
            return this.failure(`Failed to get directory tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async buildTree(uri: vscode.Uri, maxDepth: number, includeFiles: boolean, depth: number, prefix: string): Promise<string> {
        if (depth > maxDepth) return '';

        const lines: string[] = [];
        const items = await vscode.workspace.fs.readDirectory(uri);
        
        const dirs = items.filter(([, type]) => type === vscode.FileType.Directory);
        const files = includeFiles ? items.filter(([, type]) => type === vscode.FileType.File) : [];
        
        const allItems = [...dirs, ...files];

        for (let i = 0; i < allItems.length; i++) {
            const [name, type] = allItems[i];
            const isLast = i === allItems.length - 1;
            const connector = isLast ? '+-- ' : '|-- ';
            const newPrefix = prefix + (isLast ? '    ' : '|   ');

            if (type === vscode.FileType.Directory) {
                lines.push(`${prefix}${connector}${name}/`);
                if (depth < maxDepth) {
                    const subTree = await this.buildTree(
                        vscode.Uri.joinPath(uri, name),
                        maxDepth,
                        includeFiles,
                        depth + 1,
                        newPrefix
                    );
                    if (subTree) lines.push(subTree);
                }
            } else {
                lines.push(`${prefix}${connector}${name}`);
            }
        }

        return lines.join('\n');
    }
}

export class CreateFileTool extends BaseTool {
    name = 'create_file';
    description = 'Create a new file or directory';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path for the new file or directory' },
                    content: { type: 'string', description: 'Initial content for file (optional)' },
                    isDirectory: { type: 'boolean', description: 'Create as directory (default: false)' }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const filePath = input.path as string;
            const content = input.content as string || '';
            const isDirectory = input.isDirectory as boolean || false;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceFolders[0].uri.fsPath, filePath);

            const uri = vscode.Uri.file(fullPath);

            if (isDirectory) {
                await vscode.workspace.fs.createDirectory(uri);
                return this.success(`Created directory: ${fullPath}`);
            } else {
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
                return this.success(`Created file: ${fullPath}`);
            }
        } catch (error) {
            return this.failure(`Failed to create: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class DeleteFileTool extends BaseTool {
    name = 'delete_file';
    description = 'Delete a file or directory';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path to delete' },
                    recursive: { type: 'boolean', description: 'Delete recursively for directories (default: false)' }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const filePath = input.path as string;
            const recursive = input.recursive as boolean || false;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceFolders[0].uri.fsPath, filePath);

            const uri = vscode.Uri.file(fullPath);
            await vscode.workspace.fs.delete(uri, { recursive });

            return this.success(`Deleted: ${fullPath}`);
        } catch (error) {
            return this.failure(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class SearchInFileTool extends BaseTool {
    name = 'search_in_file';
    description = 'Search for text or pattern within a specific file';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to search in' },
                    query: { type: 'string', description: 'Search query' },
                    isRegex: { type: 'boolean', description: 'Treat query as regex (default: false)' },
                    caseSensitive: { type: 'boolean', description: 'Case sensitive search (default: false)' }
                },
                required: ['path', 'query']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const filePath = input.path as string;
            const query = input.query as string;
            const isRegex = input.isRegex as boolean || false;
            const caseSensitive = input.caseSensitive as boolean || false;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceFolders[0].uri.fsPath, filePath);

            const uri = vscode.Uri.file(fullPath);
            const content = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(content);
            const lines = text.split('\n');

            const matches: Array<{ line: number; content: string }> = [];
            const regex = isRegex 
                ? new RegExp(query, caseSensitive ? 'g' : 'gi')
                : null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const found = isRegex 
                    ? regex!.test(line)
                    : caseSensitive 
                        ? line.includes(query)
                        : line.toLowerCase().includes(query.toLowerCase());

                if (found) {
                    matches.push({ line: i + 1, content: line.trim() });
                }
            }

            if (matches.length === 0) {
                return this.success('No matches found');
            }

            const output = matches
                .slice(0, 50)
                .map(m => `Line ${m.line}: ${m.content}`)
                .join('\n');

            const suffix = matches.length > 50 ? `\n... and ${matches.length - 50} more matches` : '';

            return this.success(`Found ${matches.length} matches:\n${output}${suffix}`, { matches });
        } catch (error) {
            return this.failure(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class EditFileTool extends BaseTool {
    name = 'edit_file';
    description = 'Edit a file using search and replace blocks';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to edit' },
                    searchReplaceBlocks: { 
                        type: 'string', 
                        description: 'Search and replace blocks in format: <<<<<<< SEARCH\\nold_content\\n=======\\nnew_content\\n>>>>>>> REPLACE' 
                    }
                },
                required: ['path', 'searchReplaceBlocks']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const filePath = input.path as string;
            const searchReplaceBlocks = input.searchReplaceBlocks as string;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceFolders[0].uri.fsPath, filePath);

            const uri = vscode.Uri.file(fullPath);
            const content = await vscode.workspace.fs.readFile(uri);
            let text = new TextDecoder().decode(content);

            const blockRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
            let match;
            let replacements = 0;

            while ((match = blockRegex.exec(searchReplaceBlocks)) !== null) {
                const searchText = match[1];
                const replaceText = match[2];

                if (text.includes(searchText)) {
                    text = text.replace(searchText, replaceText);
                    replacements++;
                }
            }

            if (replacements === 0) {
                return this.failure('No matching text found to replace');
            }

            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(text));

            return this.success(`Applied ${replacements} replacement(s) to ${fullPath}`);
        } catch (error) {
            return this.failure(`Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class ReadLintErrorsTool extends BaseTool {
    name = 'read_lint_errors';
    description = 'Get lint errors and warnings for a file';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to check for lint errors' }
                },
                required: ['path']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const filePath = input.path as string;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return this.failure('No workspace folder open');
            }

            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workspaceFolders[0].uri.fsPath, filePath);

            const uri = vscode.Uri.file(fullPath);
            const diagnostics = vscode.languages.getDiagnostics(uri);

            if (diagnostics.length === 0) {
                return this.success('No lint errors found');
            }

            const errors = diagnostics
                .filter(d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning)
                .map(d => ({
                    severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
                    message: d.message,
                    line: d.range.start.line + 1,
                    column: d.range.start.character + 1,
                    source: d.source || 'unknown'
                }));

            const output = errors
                .map(e => `[${e.severity}] Line ${e.line}:${e.column} - ${e.message} (${e.source})`)
                .join('\n');

            return this.success(`Found ${errors.length} issue(s):\n${output}`, { errors });
        } catch (error) {
            return this.failure(`Failed to read lint errors: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export function createFileSystemTools(outputChannel: vscode.OutputChannel): BaseTool[] {
    return [
        new ListDirectoryTool(outputChannel),
        new GetDirectoryTreeTool(outputChannel),
        new CreateFileTool(outputChannel),
        new DeleteFileTool(outputChannel),
        new SearchInFileTool(outputChannel),
        new EditFileTool(outputChannel),
        new ReadLintErrorsTool(outputChannel)
    ];
}
