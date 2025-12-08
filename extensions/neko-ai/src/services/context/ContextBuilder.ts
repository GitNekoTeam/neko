import * as vscode from 'vscode';
import * as path from 'path';
import { CodeIndexManager } from '../code-index/CodeIndexManager';
import { countTokens, truncateToTokens } from '../../utils/tokenizer';
import { getLanguageId, readFileContent } from '../../utils/fileUtils';

export interface ContextItem {
    type: 'file' | 'selection' | 'search' | 'terminal' | 'browser' | 'custom';
    content: string;
    source: string;
    tokens: number;
    priority: number;
}

export class ContextBuilder {
    private outputChannel: vscode.OutputChannel;
    private codeIndexManager: CodeIndexManager;
    private maxTokens: number;
    private items: ContextItem[] = [];

    constructor(
        outputChannel: vscode.OutputChannel,
        codeIndexManager: CodeIndexManager,
        maxTokens: number = 8000
    ) {
        this.outputChannel = outputChannel;
        this.codeIndexManager = codeIndexManager;
        this.maxTokens = maxTokens;
    }

    async addCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const content = document.getText();
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        const language = document.languageId;

        await this.addItem({
            type: 'file',
            content: `Current file: ${relativePath}\n\`\`\`${language}\n${content}\n\`\`\``,
            source: relativePath,
            tokens: await countTokens(content),
            priority: 10
        });
    }

    async addSelection(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) return;

        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection);
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        const language = document.languageId;

        await this.addItem({
            type: 'selection',
            content: `Selected code in ${relativePath} (lines ${selection.start.line + 1}-${selection.end.line + 1}):\n\`\`\`${language}\n${selectedText}\n\`\`\``,
            source: relativePath,
            tokens: await countTokens(selectedText),
            priority: 15
        });
    }

    async addRelevantFiles(query: string, limit: number = 5): Promise<void> {
        const results = await this.codeIndexManager.search(query, limit);

        for (const result of results) {
            await this.addItem({
                type: 'search',
                content: `Relevant code from ${result.file} (lines ${result.startLine}-${result.endLine}):\n\`\`\`\n${result.content}\n\`\`\``,
                source: result.file,
                tokens: await countTokens(result.content),
                priority: 5 + result.score
            });
        }
    }

    async addFile(filePath: string): Promise<void> {
        const absolutePath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

        const content = await readFileContent(absolutePath);
        if (!content) return;

        const language = getLanguageId(filePath);
        const relativePath = vscode.workspace.asRelativePath(absolutePath);

        await this.addItem({
            type: 'file',
            content: `File: ${relativePath}\n\`\`\`${language}\n${content}\n\`\`\``,
            source: relativePath,
            tokens: await countTokens(content),
            priority: 8
        });
    }

    async addTerminalOutput(output: string, command?: string): Promise<void> {
        const header = command ? `Terminal output for: ${command}` : 'Terminal output';
        await this.addItem({
            type: 'terminal',
            content: `${header}:\n\`\`\`\n${output}\n\`\`\``,
            source: 'terminal',
            tokens: await countTokens(output),
            priority: 7
        });
    }

    async addBrowserInfo(info: { url?: string; console?: string[]; screenshot?: string }): Promise<void> {
        let content = 'Browser context:\n';
        
        if (info.url) {
            content += `URL: ${info.url}\n`;
        }
        
        if (info.console && info.console.length > 0) {
            content += `Console messages:\n${info.console.join('\n')}\n`;
        }

        await this.addItem({
            type: 'browser',
            content,
            source: 'browser',
            tokens: await countTokens(content),
            priority: 6
        });
    }

    async addCustomContext(content: string, source: string, priority: number = 5): Promise<void> {
        await this.addItem({
            type: 'custom',
            content,
            source,
            tokens: await countTokens(content),
            priority
        });
    }

    private async addItem(item: ContextItem): Promise<void> {
        this.items.push(item);
    }

    async build(): Promise<string> {
        this.items.sort((a, b) => b.priority - a.priority);

        let totalTokens = 0;
        const includedItems: ContextItem[] = [];

        for (const item of this.items) {
            if (totalTokens + item.tokens <= this.maxTokens) {
                includedItems.push(item);
                totalTokens += item.tokens;
            } else if (totalTokens < this.maxTokens) {
                const remainingTokens = this.maxTokens - totalTokens;
                const truncatedContent = await truncateToTokens(item.content, remainingTokens);
                includedItems.push({
                    ...item,
                    content: truncatedContent + '\n[truncated]',
                    tokens: remainingTokens
                });
                break;
            }
        }

        this.outputChannel.appendLine(
            `Context built: ${includedItems.length} items, ${totalTokens} tokens`
        );

        return includedItems.map(item => item.content).join('\n\n');
    }

    clear(): void {
        this.items = [];
    }

    getTokenCount(): number {
        return this.items.reduce((sum, item) => sum + item.tokens, 0);
    }
}
