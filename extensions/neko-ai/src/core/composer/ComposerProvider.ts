import * as vscode from 'vscode';
import { BaseProvider } from '../../api/providers/BaseProvider';
import { createUnifiedDiff } from '../../utils/diff';
import { readFileContent, getLanguageId } from '../../utils/fileUtils';

export interface FileEdit {
    filePath: string;
    originalContent: string;
    newContent: string;
    status: 'pending' | 'applied' | 'rejected';
}

export type ComposerStatus = 'planning' | 'generating' | 'preview' | 'applying' | 'completed' | 'cancelled';

export interface ComposerSession {
    id: string;
    instruction: string;
    files: string[];
    edits: FileEdit[];
    status: ComposerStatus;
    createdAt: number;
}

export class ComposerProvider {
    private outputChannel: vscode.OutputChannel;
    private provider: BaseProvider;
    private sessions: Map<string, ComposerSession> = new Map();
    private currentSession: ComposerSession | null = null;

    constructor(outputChannel: vscode.OutputChannel, provider: BaseProvider) {
        this.outputChannel = outputChannel;
        this.provider = provider;
    }

    async startComposer(): Promise<void> {
        const instruction = await vscode.window.showInputBox({
            prompt: 'Describe the changes you want to make across multiple files',
            placeHolder: 'e.g., "Add error handling to all API calls", "Refactor authentication logic"',
            ignoreFocusOut: true
        });

        if (!instruction) return;

        const files = await this.selectFiles();
        if (files.length === 0) return;

        const sessionId = `composer-${Date.now()}`;
        const session: ComposerSession = {
            id: sessionId,
            instruction,
            files,
            edits: [],
            status: 'planning',
            createdAt: Date.now()
        };

        this.sessions.set(sessionId, session);
        this.currentSession = session;

        await this.generateEdits(session);
    }

    private async selectFiles(): Promise<string[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return [];
        }

        const allFiles = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,java,go,rs,cpp,c,h,css,html,json,yaml,yml,md}', '**/node_modules/**');
        
        const items = allFiles.map(uri => ({
            label: vscode.workspace.asRelativePath(uri),
            uri,
            picked: false
        }));

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select files to include in the edit',
            title: 'Composer - Select Files'
        });

        return selected?.map(item => item.uri.fsPath) || [];
    }

    private isCancelled(session: ComposerSession): boolean {
        return session.status === 'cancelled';
    }

    private async generateEdits(session: ComposerSession): Promise<void> {
        session.status = 'generating';

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Composer: Generating edits...',
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                session.status = 'cancelled';
            });

            const fileContents: { path: string; content: string; language: string }[] = [];

            for (const filePath of session.files) {
                const content = await readFileContent(filePath);
                if (content) {
                    fileContents.push({
                        path: vscode.workspace.asRelativePath(filePath),
                        content,
                        language: getLanguageId(filePath)
                    });
                }
            }

            progress.report({ message: 'Analyzing files...' });

            const plan = await this.generatePlan(session.instruction, fileContents);
            
            if (this.isCancelled(session)) return;

            progress.report({ message: 'Generating changes...' });

            for (let i = 0; i < fileContents.length; i++) {
                if (this.isCancelled(session)) return;

                const file = fileContents[i];
                progress.report({ 
                    message: `Editing ${file.path} (${i + 1}/${fileContents.length})`,
                    increment: (100 / fileContents.length)
                });

                const newContent = await this.generateFileEdit(
                    session.instruction,
                    file,
                    plan,
                    fileContents
                );

                if (newContent && newContent !== file.content) {
                    session.edits.push({
                        filePath: session.files[i],
                        originalContent: file.content,
                        newContent,
                        status: 'pending'
                    });
                }
            }

            session.status = 'preview';
            await this.showPreview(session);
        });
    }

    private async generatePlan(instruction: string, files: { path: string; content: string; language: string }[]): Promise<string> {
        const fileList = files.map(f => `- ${f.path} (${f.language})`).join('\n');

        const prompt = `You are planning a multi-file code edit.

User instruction: ${instruction}

Files to edit:
${fileList}

Create a brief plan describing what changes need to be made to each file. Be specific about:
1. What functions/classes need to be modified
2. What new code needs to be added
3. What code needs to be removed or refactored

Keep the plan concise but actionable.`;

        const response = await this.provider.complete({
            messages: [
                { role: 'system', content: 'You are a code planning assistant. Create concise, actionable plans for code changes.' },
                { role: 'user', content: prompt }
            ],
            maxTokens: 1024,
            temperature: 0.3
        });

        return response.content;
    }

    private async generateFileEdit(
        instruction: string,
        file: { path: string; content: string; language: string },
        plan: string,
        allFiles: { path: string; content: string; language: string }[]
    ): Promise<string> {
        const otherFilesContext = allFiles
            .filter(f => f.path !== file.path)
            .map(f => `File: ${f.path}\n\`\`\`${f.language}\n${f.content.substring(0, 1000)}${f.content.length > 1000 ? '\n... (truncated)' : ''}\n\`\`\``)
            .join('\n\n');

        const prompt = `You are editing the file "${file.path}".

Overall instruction: ${instruction}

Plan:
${plan}

Current file content:
\`\`\`${file.language}
${file.content}
\`\`\`

Other files in the edit (for context):
${otherFilesContext}

Output the complete modified file content. Do not include any explanation or markdown formatting. Output only the raw code.`;

        const response = await this.provider.complete({
            messages: [
                { role: 'system', content: 'You are a code editor. Output only the complete modified file content without any explanation or formatting.' },
                { role: 'user', content: prompt }
            ],
            maxTokens: 4096,
            temperature: 0.2
        });

        return this.cleanGeneratedCode(response.content, file.language);
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

    private async showPreview(session: ComposerSession): Promise<void> {
        if (session.edits.length === 0) {
            vscode.window.showInformationMessage('No changes needed for the selected files');
            return;
        }

        const diffContent = session.edits.map(edit => {
            const relativePath = vscode.workspace.asRelativePath(edit.filePath);
            const diff = createUnifiedDiff(edit.originalContent, edit.newContent, relativePath, relativePath);
            return `=== ${relativePath} ===\n${diff}`;
        }).join('\n\n');

        const diffDocument = await vscode.workspace.openTextDocument({
            content: diffContent,
            language: 'diff'
        });

        await vscode.window.showTextDocument(diffDocument, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true
        });

        const choice = await vscode.window.showInformationMessage(
            `Apply ${session.edits.length} file edit(s)?`,
            { modal: false },
            'Apply All',
            'Review Each',
            'Cancel'
        );

        if (choice === 'Apply All') {
            await this.applyAllEdits(session);
        } else if (choice === 'Review Each') {
            await this.reviewEditsIndividually(session);
        } else {
            session.status = 'cancelled';
        }
    }

    private async applyAllEdits(session: ComposerSession): Promise<void> {
        session.status = 'applying';
        let applied = 0;

        for (const edit of session.edits) {
            try {
                const uri = vscode.Uri.file(edit.filePath);
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(uri, encoder.encode(edit.newContent));
                edit.status = 'applied';
                applied++;
            } catch (error) {
                this.outputChannel.appendLine(`Failed to apply edit to ${edit.filePath}: ${error}`);
                edit.status = 'rejected';
            }
        }

        session.status = 'completed';
        vscode.window.showInformationMessage(`Applied ${applied}/${session.edits.length} edits`);
    }

    private async reviewEditsIndividually(session: ComposerSession): Promise<void> {
        for (const edit of session.edits) {
            const relativePath = vscode.workspace.asRelativePath(edit.filePath);
            const diff = createUnifiedDiff(edit.originalContent, edit.newContent, relativePath, relativePath);

            const diffDocument = await vscode.workspace.openTextDocument({
                content: diff,
                language: 'diff'
            });

            await vscode.window.showTextDocument(diffDocument, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true
            });

            const choice = await vscode.window.showInformationMessage(
                `Apply changes to ${relativePath}?`,
                'Apply',
                'Skip',
                'Cancel All'
            );

            if (choice === 'Apply') {
                try {
                    const uri = vscode.Uri.file(edit.filePath);
                    const encoder = new TextEncoder();
                    await vscode.workspace.fs.writeFile(uri, encoder.encode(edit.newContent));
                    edit.status = 'applied';
                } catch (error) {
                    this.outputChannel.appendLine(`Failed to apply edit: ${error}`);
                    edit.status = 'rejected';
                }
            } else if (choice === 'Cancel All') {
                session.status = 'cancelled';
                return;
            } else {
                edit.status = 'rejected';
            }
        }

        session.status = 'completed';
        const applied = session.edits.filter(e => e.status === 'applied').length;
        vscode.window.showInformationMessage(`Applied ${applied}/${session.edits.length} edits`);
    }

    getCurrentSession(): ComposerSession | null {
        return this.currentSession;
    }

    cancelCurrentSession(): void {
        if (this.currentSession) {
            this.currentSession.status = 'cancelled';
            this.currentSession = null;
        }
    }
}
