import * as vscode from 'vscode';
import { createUnifiedDiff } from '../../utils/diff';

export interface PendingChange {
    id: string;
    filePath: string;
    originalContent: string;
    newContent: string;
    description: string;
    createdAt: number;
}

export class DiffPreviewProvider implements vscode.TextDocumentContentProvider {
    private outputChannel: vscode.OutputChannel;
    private pendingChanges: Map<string, PendingChange> = new Map();
    private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    static readonly scheme = 'neko-diff';

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        const changeId = uri.path.replace(/^\//, '').replace(/\.diff$/, '');
        const change = this.pendingChanges.get(changeId);

        if (!change) {
            return '// No pending change found';
        }

        return change.newContent;
    }

    async addPendingChange(
        filePath: string,
        originalContent: string,
        newContent: string,
        description: string
    ): Promise<string> {
        const id = `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const change: PendingChange = {
            id,
            filePath,
            originalContent,
            newContent,
            description,
            createdAt: Date.now()
        };

        this.pendingChanges.set(id, change);
        return id;
    }

    async showDiffPreview(changeId: string): Promise<void> {
        const change = this.pendingChanges.get(changeId);
        if (!change) {
            vscode.window.showErrorMessage('Change not found');
            return;
        }

        const originalUri = vscode.Uri.file(change.filePath);
        const modifiedUri = vscode.Uri.parse(`${DiffPreviewProvider.scheme}:/${changeId}.diff`);

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            `${vscode.workspace.asRelativePath(change.filePath)} (Preview Changes)`,
            { preview: true }
        );
    }

    async showInlineDiff(changeId: string): Promise<void> {
        const change = this.pendingChanges.get(changeId);
        if (!change) return;

        const diff = createUnifiedDiff(
            change.originalContent,
            change.newContent,
            'original',
            'modified'
        );

        const diffDocument = await vscode.workspace.openTextDocument({
            content: `File: ${vscode.workspace.asRelativePath(change.filePath)}\nDescription: ${change.description}\n\n${diff}`,
            language: 'diff'
        });

        await vscode.window.showTextDocument(diffDocument, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true,
            preserveFocus: true
        });
    }

    async applyChange(changeId: string): Promise<boolean> {
        const change = this.pendingChanges.get(changeId);
        if (!change) {
            vscode.window.showErrorMessage('Change not found');
            return false;
        }

        try {
            const uri = vscode.Uri.file(change.filePath);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(change.newContent));

            this.pendingChanges.delete(changeId);
            vscode.window.showInformationMessage(`Applied changes to ${vscode.workspace.asRelativePath(change.filePath)}`);
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to apply change: ${error}`);
            vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
            return false;
        }
    }

    async rejectChange(changeId: string): Promise<void> {
        this.pendingChanges.delete(changeId);
        vscode.window.showInformationMessage('Change rejected');
    }

    async applyAllChanges(): Promise<{ applied: number; failed: number }> {
        let applied = 0;
        let failed = 0;

        for (const [changeId] of this.pendingChanges) {
            const success = await this.applyChange(changeId);
            if (success) {
                applied++;
            } else {
                failed++;
            }
        }

        return { applied, failed };
    }

    async rejectAllChanges(): Promise<void> {
        this.pendingChanges.clear();
        vscode.window.showInformationMessage('All changes rejected');
    }

    getPendingChanges(): PendingChange[] {
        return Array.from(this.pendingChanges.values());
    }

    getPendingChange(changeId: string): PendingChange | undefined {
        return this.pendingChanges.get(changeId);
    }

    hasPendingChanges(): boolean {
        return this.pendingChanges.size > 0;
    }

    async showPendingChangesQuickPick(): Promise<void> {
        const changes = this.getPendingChanges();
        
        if (changes.length === 0) {
            vscode.window.showInformationMessage('No pending changes');
            return;
        }

        const items = changes.map(change => ({
            label: vscode.workspace.asRelativePath(change.filePath),
            description: change.description,
            detail: `Created ${new Date(change.createdAt).toLocaleTimeString()}`,
            change
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a pending change to preview',
            title: 'Pending Changes'
        });

        if (selected) {
            await this.showDiffPreview(selected.change.id);

            const action = await vscode.window.showInformationMessage(
                `Apply changes to ${selected.label}?`,
                'Apply',
                'Reject',
                'Cancel'
            );

            if (action === 'Apply') {
                await this.applyChange(selected.change.id);
            } else if (action === 'Reject') {
                await this.rejectChange(selected.change.id);
            }
        }
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
        this.pendingChanges.clear();
    }
}
