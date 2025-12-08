import * as vscode from 'vscode';
import { NekoProvider } from './core/webview/NekoProvider';
import { CodeIndexManager } from './services/code-index/CodeIndexManager';
import { GhostProvider } from './services/ghost/GhostProvider';
import { BrowserService } from './services/browser/BrowserService';
import { TerminalService } from './services/terminal/TerminalService';
import { ToolRegistry } from './core/tools/ToolRegistry';
import { McpClient } from './services/mcp/McpClient';
import { registerCommands } from './commands';
import { ApiProviderFactory } from './api/providers/ApiProviderFactory';
import { InlineEditProvider } from './core/inline-edit/InlineEditProvider';
import { MentionProvider } from './core/mentions/MentionProvider';
import { ChatHistoryManager } from './services/history/ChatHistoryManager';
import { ComposerProvider } from './core/composer/ComposerProvider';
import { RulesManager } from './services/rules/RulesManager';
import { DiffPreviewProvider } from './core/diff/DiffPreviewProvider';

let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('Neko AI');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Neko AI extension activating...');

    const config = vscode.workspace.getConfiguration('neko-ai');

    const apiProvider = ApiProviderFactory.create(config);
    outputChannel.appendLine(`Using provider: ${config.get('provider', 'openai')}`);

    const codeIndexManager = new CodeIndexManager(context, outputChannel);
    context.subscriptions.push(codeIndexManager);

    const terminalService = new TerminalService(
        outputChannel,
        config.get<number>('commandTimeout', 120)
    );
    context.subscriptions.push(terminalService);

    const browserService = new BrowserService(
        outputChannel,
        config.get<number>('browserDebugPort', 9222)
    );
    context.subscriptions.push(browserService);

    const toolRegistry = new ToolRegistry(
        outputChannel,
        codeIndexManager,
        terminalService,
        browserService
    );

    const mcpClient = new McpClient(outputChannel);
    context.subscriptions.push(mcpClient);
    await mcpClient.loadConfig();

    const rulesManager = new RulesManager(outputChannel);
    await rulesManager.initialize();
    context.subscriptions.push(rulesManager);

    const chatHistoryManager = new ChatHistoryManager(outputChannel, context);
    await chatHistoryManager.initialize();

    const mentionProvider = new MentionProvider(outputChannel, codeIndexManager);

    const inlineEditProvider = new InlineEditProvider(outputChannel, apiProvider);
    context.subscriptions.push(inlineEditProvider);

    const composerProvider = new ComposerProvider(outputChannel, apiProvider);

    const diffPreviewProvider = new DiffPreviewProvider(outputChannel);
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            DiffPreviewProvider.scheme,
            diffPreviewProvider
        )
    );
    context.subscriptions.push(diffPreviewProvider);

    const provider = new NekoProvider(
        context,
        outputChannel,
        apiProvider,
        codeIndexManager,
        terminalService,
        browserService,
        toolRegistry,
        chatHistoryManager,
        mentionProvider,
        rulesManager
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'neko-ai.chatView',
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    if (config.get<boolean>('enableInlineCompletion', true)) {
        const ghostProvider = new GhostProvider(context, outputChannel, apiProvider);
        context.subscriptions.push(ghostProvider);
        outputChannel.appendLine('Inline completion enabled');
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.inlineEdit', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                inlineEditProvider.startInlineEdit(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.composer', () => {
            composerProvider.startComposer();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.createRulesFile', () => {
            rulesManager.createDefaultRulesFile();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.showPendingChanges', () => {
            diffPreviewProvider.showPendingChangesQuickPick();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.showChatHistory', async () => {
            const sessions = await chatHistoryManager.listSessions();
            const items = sessions.map(s => ({
                label: s.title,
                description: `${s.messageCount} messages`,
                detail: new Date(s.updatedAt).toLocaleString(),
                sessionId: s.id
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a chat session to restore',
                title: 'Chat History'
            });

            if (selected) {
                await chatHistoryManager.loadSession(selected.sessionId);
                vscode.commands.executeCommand('neko-ai.focus');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('neko-ai.exportChat', async () => {
            const session = chatHistoryManager.getCurrentSession();
            if (!session) {
                vscode.window.showInformationMessage('No active chat session');
                return;
            }

            const markdown = await chatHistoryManager.exportSession(session.id);
            if (markdown) {
                const document = await vscode.workspace.openTextDocument({
                    content: markdown,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(document);
            }
        })
    );

    registerCommands(
        context, 
        provider, 
        codeIndexManager, 
        terminalService, 
        browserService
    );

    if (config.get<boolean>('enableCodebaseIndexing', true)) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            outputChannel.appendLine('Starting codebase indexing...');
            for (const folder of workspaceFolders) {
                codeIndexManager.indexWorkspace(folder.uri.fsPath).catch(err => {
                    outputChannel.appendLine(`Failed to index workspace: ${err.message}`);
                });
            }
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('neko-ai')) {
                outputChannel.appendLine('Configuration changed, some settings may require reload');
            }
        })
    );

    if (!context.globalState.get('neko-ai.firstRun')) {
        await context.globalState.update('neko-ai.firstRun', true);
        vscode.window.showInformationMessage(
            'Welcome to Neko AI! Configure your API key in settings to get started.',
            'Open Settings'
        ).then((selection: string | undefined) => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'neko-ai');
            }
        });
    }

    outputChannel.appendLine('Neko AI extension activated successfully');
}

export function deactivate(): void {
    outputChannel?.appendLine('Neko AI extension deactivated');
}
