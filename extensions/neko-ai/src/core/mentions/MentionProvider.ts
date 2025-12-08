import * as vscode from 'vscode';
import * as path from 'path';
import { readFileContent, getLanguageId } from '../../utils/fileUtils';
import { CodeIndexManager } from '../../services/code-index/CodeIndexManager';

export type MentionType = 'file' | 'folder' | 'symbol' | 'codebase' | 'git' | 'terminal' | 'problems' | 'docs' | 'web' | 'selection';

export interface Mention {
    type: MentionType;
    value: string;
    displayName: string;
    range?: { start: number; end: number };
}

export interface MentionContext {
    content: string;
    source: string;
    type: MentionType;
}

export class MentionProvider {
    private outputChannel: vscode.OutputChannel;
    private codeIndexManager: CodeIndexManager;

    constructor(outputChannel: vscode.OutputChannel, codeIndexManager: CodeIndexManager) {
        this.outputChannel = outputChannel;
        this.codeIndexManager = codeIndexManager;
    }

    parseMentions(text: string): Mention[] {
        const mentions: Mention[] = [];
        const mentionRegex = /@(file|folder|symbol|codebase|git|terminal|problems|docs|web|selection):([^\s]+)/g;

        let match: RegExpExecArray | null;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({
                type: match[1] as MentionType,
                value: match[2],
                displayName: `@${match[1]}:${match[2]}`,
                range: { start: match.index, end: match.index + match[0].length }
            });
        }

        const simpleMentionRegex = /@(codebase|git|terminal|problems|selection)(?:\s|$)/g;
        let simpleMatch: RegExpExecArray | null;
        while ((simpleMatch = simpleMentionRegex.exec(text)) !== null) {
            if (!mentions.some(m => m.range?.start === simpleMatch!.index)) {
                mentions.push({
                    type: simpleMatch[1] as MentionType,
                    value: '',
                    displayName: `@${simpleMatch[1]}`,
                    range: { start: simpleMatch.index, end: simpleMatch.index + simpleMatch[0].length - 1 }
                });
            }
        }

        return mentions;
    }

    async resolveMentions(mentions: Mention[]): Promise<MentionContext[]> {
        const contexts: MentionContext[] = [];

        for (const mention of mentions) {
            try {
                const context = await this.resolveMention(mention);
                if (context) {
                    contexts.push(context);
                }
            } catch (error) {
                this.outputChannel.appendLine(`Failed to resolve mention ${mention.displayName}: ${error}`);
            }
        }

        return contexts;
    }

    private async resolveMention(mention: Mention): Promise<MentionContext | null> {
        switch (mention.type) {
            case 'file':
                return this.resolveFileMention(mention.value);
            case 'folder':
                return this.resolveFolderMention(mention.value);
            case 'symbol':
                return this.resolveSymbolMention(mention.value);
            case 'codebase':
                return this.resolveCodebaseMention(mention.value);
            case 'git':
                return this.resolveGitMention();
            case 'terminal':
                return this.resolveTerminalMention();
            case 'problems':
                return this.resolveProblemsMention();
            case 'selection':
                return this.resolveSelectionMention();
            case 'docs':
                return this.resolveDocsMention(mention.value);
            case 'web':
                return this.resolveWebMention(mention.value);
            default:
                return null;
        }
    }

    private async resolveFileMention(filePath: string): Promise<MentionContext | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;

        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(workspaceFolder.uri.fsPath, filePath);

        const content = await readFileContent(absolutePath);
        if (!content) return null;

        const language = getLanguageId(filePath);
        const relativePath = vscode.workspace.asRelativePath(absolutePath);

        return {
            type: 'file',
            source: relativePath,
            content: `File: ${relativePath}\n\`\`\`${language}\n${content}\n\`\`\``
        };
    }

    private async resolveFolderMention(folderPath: string): Promise<MentionContext | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;

        const absolutePath = path.isAbsolute(folderPath)
            ? folderPath
            : path.join(workspaceFolder.uri.fsPath, folderPath);

        const uri = vscode.Uri.file(absolutePath);
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            const fileList = entries
                .map(([name, type]) => {
                    const icon = type === vscode.FileType.Directory ? '[D]' : '[F]';
                    return `${icon} ${name}`;
                })
                .join('\n');

            const relativePath = vscode.workspace.asRelativePath(absolutePath);

            return {
                type: 'folder',
                source: relativePath,
                content: `Folder: ${relativePath}\n\`\`\`\n${fileList}\n\`\`\``
            };
        } catch {
            return null;
        }
    }

    private async resolveSymbolMention(symbolName: string): Promise<MentionContext | null> {
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            symbolName
        );

        if (!symbols || symbols.length === 0) return null;

        const results: string[] = [];
        for (const symbol of symbols.slice(0, 5)) {
            const document = await vscode.workspace.openTextDocument(symbol.location.uri);
            const range = symbol.location.range;
            const startLine = Math.max(0, range.start.line - 2);
            const endLine = Math.min(document.lineCount - 1, range.end.line + 5);
            
            const content = document.getText(new vscode.Range(startLine, 0, endLine, 0));
            const relativePath = vscode.workspace.asRelativePath(symbol.location.uri);
            
            results.push(`Symbol: ${symbol.name} (${vscode.SymbolKind[symbol.kind]}) in ${relativePath}\n\`\`\`${document.languageId}\n${content}\n\`\`\``);
        }

        return {
            type: 'symbol',
            source: symbolName,
            content: results.join('\n\n')
        };
    }

    private async resolveCodebaseMention(query: string): Promise<MentionContext | null> {
        if (!query) {
            return {
                type: 'codebase',
                source: 'codebase',
                content: 'Codebase context is enabled. The AI will search the codebase for relevant information.'
            };
        }

        const results = await this.codeIndexManager.search(query, 5);
        
        if (results.length === 0) {
            return {
                type: 'codebase',
                source: query,
                content: `No results found for: ${query}`
            };
        }

        const content = results.map(r => 
            `File: ${r.file} (lines ${r.startLine}-${r.endLine})\n\`\`\`\n${r.content}\n\`\`\``
        ).join('\n\n');

        return {
            type: 'codebase',
            source: query,
            content: `Codebase search results for "${query}":\n\n${content}`
        };
    }

    private async resolveGitMention(): Promise<MentionContext | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;

        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                return {
                    type: 'git',
                    source: 'git',
                    content: 'Git extension not available'
                };
            }

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            
            if (!repo) {
                return {
                    type: 'git',
                    source: 'git',
                    content: 'No git repository found'
                };
            }

            const diff = await repo.diff();
            const branch = repo.state.HEAD?.name || 'unknown';
            const changes = repo.state.workingTreeChanges.length;

            return {
                type: 'git',
                source: 'git',
                content: `Git Status:\n- Branch: ${branch}\n- Working tree changes: ${changes}\n\nDiff:\n\`\`\`diff\n${diff || 'No changes'}\n\`\`\``
            };
        } catch (error) {
            return {
                type: 'git',
                source: 'git',
                content: `Git info unavailable: ${error}`
            };
        }
    }

    private async resolveTerminalMention(): Promise<MentionContext | null> {
        const terminal = vscode.window.activeTerminal;
        
        return {
            type: 'terminal',
            source: 'terminal',
            content: terminal 
                ? `Active terminal: ${terminal.name}\n(Terminal output capture requires terminal integration)`
                : 'No active terminal'
        };
    }

    private async resolveProblemsMention(): Promise<MentionContext | null> {
        const diagnostics = vscode.languages.getDiagnostics();
        const problems: string[] = [];

        for (const [uri, diags] of diagnostics) {
            const relativePath = vscode.workspace.asRelativePath(uri);
            for (const diag of diags) {
                if (diag.severity === vscode.DiagnosticSeverity.Error || 
                    diag.severity === vscode.DiagnosticSeverity.Warning) {
                    const severity = diag.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warning';
                    problems.push(`[${severity}] ${relativePath}:${diag.range.start.line + 1}: ${diag.message}`);
                }
            }
        }

        return {
            type: 'problems',
            source: 'problems',
            content: problems.length > 0
                ? `Current problems:\n\`\`\`\n${problems.slice(0, 20).join('\n')}\n\`\`\``
                : 'No problems found'
        };
    }

    private async resolveSelectionMention(): Promise<MentionContext | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            return {
                type: 'selection',
                source: 'selection',
                content: 'No text selected'
            };
        }

        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection);
        const relativePath = vscode.workspace.asRelativePath(document.uri);

        return {
            type: 'selection',
            source: relativePath,
            content: `Selected code in ${relativePath} (lines ${selection.start.line + 1}-${selection.end.line + 1}):\n\`\`\`${document.languageId}\n${selectedText}\n\`\`\``
        };
    }

    private async resolveDocsMention(docPath: string): Promise<MentionContext | null> {
        return {
            type: 'docs',
            source: docPath,
            content: `Documentation reference: ${docPath}\n(Documentation indexing not yet implemented)`
        };
    }

    private async resolveWebMention(url: string): Promise<MentionContext | null> {
        return {
            type: 'web',
            source: url,
            content: `Web reference: ${url}\n(Web content fetching not yet implemented)`
        };
    }

    getCompletionItems(prefix: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const mentionTypes: { type: MentionType; description: string; hasValue: boolean }[] = [
            { type: 'file', description: 'Reference a file', hasValue: true },
            { type: 'folder', description: 'Reference a folder', hasValue: true },
            { type: 'symbol', description: 'Reference a symbol', hasValue: true },
            { type: 'codebase', description: 'Search the codebase', hasValue: true },
            { type: 'git', description: 'Git status and diff', hasValue: false },
            { type: 'terminal', description: 'Terminal context', hasValue: false },
            { type: 'problems', description: 'Current problems', hasValue: false },
            { type: 'selection', description: 'Current selection', hasValue: false },
            { type: 'docs', description: 'Reference documentation', hasValue: true },
            { type: 'web', description: 'Reference a URL', hasValue: true }
        ];

        for (const { type, description, hasValue } of mentionTypes) {
            if (type.startsWith(prefix.replace('@', ''))) {
                const item = new vscode.CompletionItem(`@${type}`, vscode.CompletionItemKind.Reference);
                item.detail = description;
                item.insertText = hasValue ? `@${type}:` : `@${type}`;
                items.push(item);
            }
        }

        return items;
    }
}
