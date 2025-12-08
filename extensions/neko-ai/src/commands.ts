import * as vscode from 'vscode';
import { NekoProvider } from './core/webview/NekoProvider';
import { CodeIndexManager } from './services/code-index/CodeIndexManager';
import { TerminalService } from './services/terminal/TerminalService';
import { BrowserService } from './services/browser/BrowserService';

export function registerCommands(
    context: vscode.ExtensionContext,
    provider: NekoProvider,
    codeIndexManager: CodeIndexManager,
    terminalService: TerminalService,
    browserService: BrowserService
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.newChat', () => {
            provider.newChat();
        }),

        vscode.commands.registerCommand('neko-ai.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.selection;
            const text = editor.document.getText(selection.isEmpty ? undefined : selection);
            
            await provider.addToContext(
                `Please explain this code:\n\`\`\`${editor.document.languageId}\n${text}\n\`\`\``,
                editor.document.fileName
            );
        }),

        vscode.commands.registerCommand('neko-ai.fixCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.selection;
            const text = editor.document.getText(selection.isEmpty ? undefined : selection);
            
            await provider.addToContext(
                `Please fix any issues in this code:\n\`\`\`${editor.document.languageId}\n${text}\n\`\`\``,
                editor.document.fileName
            );
        }),

        vscode.commands.registerCommand('neko-ai.improveCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.selection;
            const text = editor.document.getText(selection.isEmpty ? undefined : selection);
            
            await provider.addToContext(
                `Please improve this code (performance, readability, best practices):\n\`\`\`${editor.document.languageId}\n${text}\n\`\`\``,
                editor.document.fileName
            );
        }),

        vscode.commands.registerCommand('neko-ai.addToContext', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showInformationMessage('Please select some code first');
                return;
            }

            const text = editor.document.getText(selection);
            await provider.addToContext(text, editor.document.fileName);
        }),

        vscode.commands.registerCommand('neko-ai.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'neko-ai');
        }),

        vscode.commands.registerCommand('neko-ai.openBrowser', async () => {
            await browserService.openBrowserPanel();
        }),

        vscode.commands.registerCommand('neko-ai.indexCodebase', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Indexing codebase...',
                    cancellable: false
                },
                async () => {
                    for (const folder of workspaceFolders) {
                        await codeIndexManager.indexWorkspace(folder.uri.fsPath);
                    }
                }
            );

            vscode.window.showInformationMessage(
                `Indexed ${codeIndexManager.getIndexedFileCount()} files`
            );
        }),

        vscode.commands.registerCommand('neko-ai.searchCodebase', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search codebase',
                placeHolder: 'Enter search query...'
            });

            if (!query) return;

            const results = await codeIndexManager.search(query, 20);
            
            if (results.length === 0) {
                vscode.window.showInformationMessage('No results found');
                return;
            }

            const items = results.map(r => ({
                label: r.file,
                description: `Lines ${r.startLine}-${r.endLine}`,
                detail: r.content.slice(0, 100).replace(/\n/g, ' '),
                result: r
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a result to open'
            });

            if (selected) {
                const uri = vscode.Uri.file(
                    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath + '/' + selected.result.file
                );
                const doc = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(doc);
                
                const range = new vscode.Range(
                    selected.result.startLine, 0,
                    selected.result.endLine, 0
                );
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.end);
            }
        }),

        vscode.commands.registerCommand('neko-ai.generateCommitMessage', async () => {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                vscode.window.showErrorMessage('Git extension not found');
                return;
            }

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            
            if (!repo) {
                vscode.window.showErrorMessage('No Git repository found');
                return;
            }

            const diff = await repo.diff(true);
            if (!diff) {
                vscode.window.showInformationMessage('No staged changes');
                return;
            }

            await provider.addToContext(
                `Generate a concise commit message for these changes:\n\`\`\`diff\n${diff}\n\`\`\``,
                'git diff'
            );
        }),

        vscode.commands.registerCommand('neko-ai.triggerInlineCompletion', () => {
            vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
        }),

        vscode.commands.registerCommand('neko-ai.acceptInlineCompletion', () => {
            vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
        }),

        vscode.commands.registerCommand('neko-ai.cancelInlineCompletion', () => {
            vscode.commands.executeCommand('editor.action.inlineSuggest.hide');
        }),

        vscode.commands.registerCommand('neko-ai.terminalExecute', async () => {
            const command = await vscode.window.showInputBox({
                prompt: 'Enter command to execute',
                placeHolder: 'npm install, git status, etc.'
            });

            if (!command) return;

            await terminalService.runWithProgress(command, `Executing: ${command}`);
        }),

        vscode.commands.registerCommand('neko-ai.terminalExplain', async () => {
            const terminal = vscode.window.activeTerminal;
            if (!terminal) {
                vscode.window.showInformationMessage('No active terminal');
                return;
            }

            await provider.addToContext(
                'Please explain the last terminal output and suggest fixes if there are errors.',
                'terminal'
            );
        })
    );
}
