import * as vscode from 'vscode';
import { BaseProvider } from '../../api/providers/BaseProvider';

interface InlineCompletion {
    text: string;
    range: vscode.Range;
}

export class GhostProvider implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private apiProvider: BaseProvider;
    private disposables: vscode.Disposable[] = [];
    private currentCompletion: InlineCompletion | undefined;
    private decorationType: vscode.TextEditorDecorationType;
    private isGenerating = false;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel,
        apiProvider: BaseProvider
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.apiProvider = apiProvider;

        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });

        this.registerProviders();
        this.registerEventHandlers();
    }

    private registerProviders(): void {
        const inlineProvider = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**/*' },
            {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    return this.provideInlineCompletions(document, position, context, token);
                }
            }
        );
        this.disposables.push(inlineProvider);
    }

    private registerEventHandlers(): void {
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(() => {
                this.clearCompletion();
            }),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.contentChanges.length > 0) {
                    this.scheduleCompletion();
                }
            })
        );
    }

    private scheduleCompletion(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.triggerCompletion();
        }, 500);
    }

    async triggerCompletion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || this.isGenerating) return;

        const document = editor.document;
        const position = editor.selection.active;

        try {
            this.isGenerating = true;
            await vscode.commands.executeCommand('setContext', 'neko-ai.isGenerating', true);

            const completion = await this.generateCompletion(document, position);
            
            if (completion) {
                this.currentCompletion = {
                    text: completion,
                    range: new vscode.Range(position, position)
                };
                this.showGhostText(editor, position, completion);
                await vscode.commands.executeCommand('setContext', 'neko-ai.hasInlineCompletion', true);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Completion error: ${error}`);
        } finally {
            this.isGenerating = false;
            await vscode.commands.executeCommand('setContext', 'neko-ai.isGenerating', false);
        }
    }

    private async generateCompletion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<string | undefined> {
        const prefix = document.getText(new vscode.Range(
            new vscode.Position(Math.max(0, position.line - 50), 0),
            position
        ));

        const suffix = document.getText(new vscode.Range(
            position,
            new vscode.Position(Math.min(document.lineCount - 1, position.line + 20), 0)
        ));

        if (prefix.trim().length < 5) return undefined;

        const language = document.languageId;

        try {
            const completion = await this.apiProvider.inlineComplete(prefix, suffix, language);
            
            if (completion && completion.length > 0 && completion.length < 500) {
                return completion;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Inline completion error: ${error}`);
        }

        return undefined;
    }

    private showGhostText(
        editor: vscode.TextEditor,
        position: vscode.Position,
        text: string
    ): void {
        const lines = text.split('\n');
        const firstLine = lines[0];
        
        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(position, position),
            renderOptions: {
                after: {
                    contentText: firstLine,
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic'
                }
            }
        };

        editor.setDecorations(this.decorationType, [decoration]);
    }

    async acceptCompletion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.currentCompletion) return;

        await editor.edit(editBuilder => {
            editBuilder.insert(this.currentCompletion!.range.start, this.currentCompletion!.text);
        });

        this.clearCompletion();
    }

    clearCompletion(): void {
        this.currentCompletion = undefined;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
        }
        vscode.commands.executeCommand('setContext', 'neko-ai.hasInlineCompletion', false);
    }

    private async provideInlineCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        _context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | undefined> {
        if (token.isCancellationRequested) return undefined;

        const completion = await this.generateCompletion(document, position);
        if (!completion) return undefined;

        return [
            new vscode.InlineCompletionItem(
                completion,
                new vscode.Range(position, position)
            )
        ];
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
