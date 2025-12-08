import * as vscode from 'vscode';
import { BaseProvider } from '../../api/providers/BaseProvider';
import { createUnifiedDiff } from '../../utils/diff';

export interface InlineEditSession {
    id: string;
    document: vscode.TextDocument;
    range: vscode.Range;
    originalText: string;
    instruction: string;
    status: 'pending' | 'generating' | 'preview' | 'applied' | 'cancelled';
    generatedText?: string;
}

export class InlineEditProvider {
    private outputChannel: vscode.OutputChannel;
    private provider: BaseProvider;
    private sessions: Map<string, InlineEditSession> = new Map();
    private decorationType: vscode.TextEditorDecorationType;
    private previewDecorationType: vscode.TextEditorDecorationType;

    constructor(outputChannel: vscode.OutputChannel, provider: BaseProvider) {
        this.outputChannel = outputChannel;
        this.provider = provider;

        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.findMatchBorder')
        });

        this.previewDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            after: {
                contentText: ' [Preview - Enter to apply, Esc to cancel]',
                color: new vscode.ThemeColor('editorGhostText.foreground')
            }
        });
    }

    async startInlineEdit(editor: vscode.TextEditor): Promise<void> {
        const selection = editor.selection;
        const document = editor.document;

        let range: vscode.Range;
        if (selection.isEmpty) {
            range = document.lineAt(selection.active.line).range;
        } else {
            range = new vscode.Range(selection.start, selection.end);
        }

        const originalText = document.getText(range);

        const instruction = await vscode.window.showInputBox({
            prompt: 'Describe the change you want to make',
            placeHolder: 'e.g., "Add error handling", "Convert to async/await", "Add comments"',
            ignoreFocusOut: true
        });

        if (!instruction) {
            return;
        }

        const sessionId = `inline-${Date.now()}`;
        const session: InlineEditSession = {
            id: sessionId,
            document,
            range,
            originalText,
            instruction,
            status: 'generating'
        };

        this.sessions.set(sessionId, session);
        editor.setDecorations(this.decorationType, [range]);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generating edit...',
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    session.status = 'cancelled';
                    this.clearSession(sessionId, editor);
                });

                const generatedText = await this.generateEdit(session);
                
                if (session.status === 'cancelled') {
                    return;
                }

                session.generatedText = generatedText;
                session.status = 'preview';

                await this.showPreview(editor, session);
            });
        } catch (error) {
            this.outputChannel.appendLine(`Inline edit error: ${error}`);
            vscode.window.showErrorMessage('Failed to generate edit');
            this.clearSession(sessionId, editor);
        }
    }

    private async generateEdit(session: InlineEditSession): Promise<string> {
        const { document, range, originalText, instruction } = session;
        const language = document.languageId;
        const fileName = document.fileName.split('/').pop() || 'file';

        const contextBefore = this.getContextLines(document, range.start.line, -10);
        const contextAfter = this.getContextLines(document, range.end.line, 10);

        const prompt = `You are editing code in a ${language} file named "${fileName}".

Context before the selection:
\`\`\`${language}
${contextBefore}
\`\`\`

Selected code to modify:
\`\`\`${language}
${originalText}
\`\`\`

Context after the selection:
\`\`\`${language}
${contextAfter}
\`\`\`

User instruction: ${instruction}

Output ONLY the modified code that should replace the selected code. Do not include any explanation, markdown formatting, or code fences. Output the raw code only.`;

        const response = await this.provider.complete({
            messages: [
                { role: 'system', content: 'You are a code editor. Output only the modified code without any explanation or formatting.' },
                { role: 'user', content: prompt }
            ],
            maxTokens: 2048,
            temperature: 0.2
        });

        return this.cleanGeneratedCode(response.content, language);
    }

    private getContextLines(document: vscode.TextDocument, lineNumber: number, count: number): string {
        const lines: string[] = [];
        const direction = count > 0 ? 1 : -1;
        const absCount = Math.abs(count);

        for (let i = 1; i <= absCount; i++) {
            const targetLine = lineNumber + (i * direction);
            if (targetLine >= 0 && targetLine < document.lineCount) {
                if (direction > 0) {
                    lines.push(document.lineAt(targetLine).text);
                } else {
                    lines.unshift(document.lineAt(targetLine).text);
                }
            }
        }

        return lines.join('\n');
    }

    private cleanGeneratedCode(code: string, language: string): string {
        let cleaned = code.trim();
        
        const codeBlockRegex = new RegExp(`^\`\`\`(?:${language})?\\s*\\n?([\\s\\S]*?)\\n?\`\`\`$`, 'i');
        const match = cleaned.match(codeBlockRegex);
        if (match) {
            cleaned = match[1];
        }

        if (cleaned.startsWith('```')) {
            const lines = cleaned.split('\n');
            lines.shift();
            if (lines[lines.length - 1]?.trim() === '```') {
                lines.pop();
            }
            cleaned = lines.join('\n');
        }

        return cleaned;
    }

    private async showPreview(editor: vscode.TextEditor, session: InlineEditSession): Promise<void> {
        if (!session.generatedText) return;

        const diff = createUnifiedDiff(
            session.originalText,
            session.generatedText,
            'original',
            'modified'
        );

        this.outputChannel.appendLine('Generated diff:');
        this.outputChannel.appendLine(diff);

        const diffDocument = await vscode.workspace.openTextDocument({
            content: `Original:\n${session.originalText}\n\n---\n\nModified:\n${session.generatedText}\n\n---\n\nDiff:\n${diff}`,
            language: 'diff'
        });

        await vscode.window.showTextDocument(diffDocument, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true,
            preserveFocus: true
        });

        const choice = await vscode.window.showInformationMessage(
            'Apply this change?',
            { modal: false },
            'Apply',
            'Cancel'
        );

        if (choice === 'Apply') {
            await this.applyEdit(editor, session);
        } else {
            this.clearSession(session.id, editor);
        }
    }

    private async applyEdit(editor: vscode.TextEditor, session: InlineEditSession): Promise<void> {
        if (!session.generatedText) return;

        const edit = new vscode.WorkspaceEdit();
        edit.replace(session.document.uri, session.range, session.generatedText);

        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            session.status = 'applied';
            vscode.window.showInformationMessage('Edit applied successfully');
        } else {
            vscode.window.showErrorMessage('Failed to apply edit');
        }

        this.clearSession(session.id, editor);
    }

    private clearSession(sessionId: string, editor: vscode.TextEditor): void {
        this.sessions.delete(sessionId);
        editor.setDecorations(this.decorationType, []);
        editor.setDecorations(this.previewDecorationType, []);
    }

    dispose(): void {
        this.decorationType.dispose();
        this.previewDecorationType.dispose();
        this.sessions.clear();
    }
}
