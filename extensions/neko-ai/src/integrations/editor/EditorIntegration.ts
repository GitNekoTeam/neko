import * as vscode from 'vscode';
import { applyDiff } from '../../utils/diff';

export interface CodeAction {
    title: string;
    command: string;
    arguments?: unknown[];
}

export class EditorIntegration implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];
    private decorationType: vscode.TextEditorDecorationType;
    private pendingChanges: Map<string, string> = new Map();

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            isWholeLine: true
        });
    }

    async insertTextAtCursor(text: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return false;
        }

        return editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, text);
        });
    }

    async replaceSelection(text: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return false;
        }

        return editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, text);
        });
    }

    async replaceRange(uri: vscode.Uri, range: vscode.Range, text: string): Promise<boolean> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, range, text);
        return vscode.workspace.applyEdit(edit);
    }

    async applyDiff(uri: vscode.Uri, diff: string): Promise<boolean> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const originalContent = document.getText();
            const newContent = applyDiff(originalContent, diff);
            
            if (newContent === originalContent) {
                this.outputChannel.appendLine('No changes to apply');
                return false;
            }

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(originalContent.length)
            );

            return this.replaceRange(uri, fullRange, newContent);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`Failed to apply diff: ${message}`);
            return false;
        }
    }

    async showDiffPreview(originalUri: vscode.Uri, modifiedContent: string, title: string): Promise<void> {
        await vscode.workspace.openTextDocument(originalUri);
        const modifiedUri = vscode.Uri.parse(`neko-preview:${originalUri.path}?modified`);
        
        this.pendingChanges.set(modifiedUri.toString(), modifiedContent);

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            title
        );
    }

    async acceptPendingChanges(uri: vscode.Uri): Promise<boolean> {
        const previewUri = vscode.Uri.parse(`neko-preview:${uri.path}?modified`);
        const content = this.pendingChanges.get(previewUri.toString());
        
        if (!content) {
            return false;
        }

        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        const success = await this.replaceRange(uri, fullRange, content);
        if (success) {
            this.pendingChanges.delete(previewUri.toString());
        }
        return success;
    }

    async highlightLines(editor: vscode.TextEditor, startLine: number, endLine: number): Promise<void> {
        const decorations: vscode.DecorationOptions[] = [];
        
        for (let line = startLine; line <= endLine; line++) {
            const range = editor.document.lineAt(line).range;
            decorations.push({ range });
        }

        editor.setDecorations(this.decorationType, decorations);

        setTimeout(() => {
            editor.setDecorations(this.decorationType, []);
        }, 3000);
    }

    async revealLine(uri: vscode.Uri, line: number): Promise<void> {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }

    getSelectedText(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            return undefined;
        }

        return editor.document.getText(selection);
    }

    getCurrentFileContent(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        return editor.document.getText();
    }

    getCurrentFileUri(): vscode.Uri | undefined {
        return vscode.window.activeTextEditor?.document.uri;
    }

    getCurrentLanguageId(): string | undefined {
        return vscode.window.activeTextEditor?.document.languageId;
    }

    async formatDocument(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.commands.executeCommand('editor.action.formatDocument', uri);
            return true;
        } catch {
            return false;
        }
    }

    async saveDocument(uri: vscode.Uri): Promise<boolean> {
        const document = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        if (document && document.isDirty) {
            return document.save();
        }
        return true;
    }

    getPreviewContentProvider(): vscode.TextDocumentContentProvider {
        return {
            provideTextDocumentContent: (uri: vscode.Uri): string => {
                return this.pendingChanges.get(uri.toString()) || '';
            }
        };
    }

    registerCodeActionProvider(languageSelector: vscode.DocumentSelector): vscode.Disposable {
        return vscode.languages.registerCodeActionsProvider(languageSelector, {
            provideCodeActions: (
                document: vscode.TextDocument,
                range: vscode.Range,
                _context: vscode.CodeActionContext,
                _token: vscode.CancellationToken
            ): vscode.CodeAction[] => {
                const actions: vscode.CodeAction[] = [];

                if (!range.isEmpty) {
                    const explainAction = new vscode.CodeAction(
                        'Neko AI: Explain Code',
                        vscode.CodeActionKind.QuickFix
                    );
                    explainAction.command = {
                        command: 'neko-ai.explainCode',
                        title: 'Explain Code'
                    };
                    actions.push(explainAction);

                    const fixAction = new vscode.CodeAction(
                        'Neko AI: Fix Code',
                        vscode.CodeActionKind.QuickFix
                    );
                    fixAction.command = {
                        command: 'neko-ai.fixCode',
                        title: 'Fix Code'
                    };
                    actions.push(fixAction);

                    const improveAction = new vscode.CodeAction(
                        'Neko AI: Improve Code',
                        vscode.CodeActionKind.RefactorRewrite
                    );
                    improveAction.command = {
                        command: 'neko-ai.improveCode',
                        title: 'Improve Code'
                    };
                    actions.push(improveAction);
                }

                return actions;
            }
        });
    }

    dispose(): void {
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
        this.pendingChanges.clear();
    }
}
