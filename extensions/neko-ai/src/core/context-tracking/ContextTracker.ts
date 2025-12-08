import * as vscode from 'vscode';

export interface TrackedChange {
    id: string;
    type: 'file' | 'selection' | 'cursor' | 'terminal' | 'diagnostic';
    uri?: string;
    timestamp: number;
    data: unknown;
}

export interface FileChange {
    uri: string;
    changeType: 'created' | 'modified' | 'deleted';
    content?: string;
    previousContent?: string;
}

export interface CursorPosition {
    uri: string;
    line: number;
    character: number;
    selection?: { start: vscode.Position; end: vscode.Position };
}

export class ContextTracker implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private changes: TrackedChange[] = [];
    private maxChanges: number = 100;
    private fileContents: Map<string, string> = new Map();
    private onChangeCallbacks: ((change: TrackedChange) => void)[] = [];

    constructor() {
        this.setupListeners();
    }

    private setupListeners(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
            vscode.workspace.onDidCreateFiles(e => this.onFilesCreated(e)),
            vscode.workspace.onDidDeleteFiles(e => this.onFilesDeleted(e)),
            vscode.workspace.onDidRenameFiles(e => this.onFilesRenamed(e)),
            vscode.window.onDidChangeActiveTextEditor(e => this.onEditorChange(e)),
            vscode.window.onDidChangeTextEditorSelection(e => this.onSelectionChange(e)),
            vscode.languages.onDidChangeDiagnostics(e => this.onDiagnosticsChange(e))
        );
    }

    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        const uri = event.document.uri.toString();
        const previousContent = this.fileContents.get(uri);
        const currentContent = event.document.getText();
        
        this.fileContents.set(uri, currentContent);

        const change: TrackedChange = {
            id: this.generateId(),
            type: 'file',
            uri,
            timestamp: Date.now(),
            data: {
                changeType: 'modified',
                changes: event.contentChanges.map(c => ({
                    range: { start: c.range.start, end: c.range.end },
                    text: c.text,
                    rangeLength: c.rangeLength
                })),
                previousContent: previousContent?.slice(0, 1000),
                languageId: event.document.languageId
            }
        };

        this.addChange(change);
    }

    private onFilesCreated(event: vscode.FileCreateEvent): void {
        for (const file of event.files) {
            const change: TrackedChange = {
                id: this.generateId(),
                type: 'file',
                uri: file.toString(),
                timestamp: Date.now(),
                data: { changeType: 'created' }
            };
            this.addChange(change);
        }
    }

    private onFilesDeleted(event: vscode.FileDeleteEvent): void {
        for (const file of event.files) {
            const uri = file.toString();
            const previousContent = this.fileContents.get(uri);
            this.fileContents.delete(uri);

            const change: TrackedChange = {
                id: this.generateId(),
                type: 'file',
                uri,
                timestamp: Date.now(),
                data: { 
                    changeType: 'deleted',
                    previousContent: previousContent?.slice(0, 1000)
                }
            };
            this.addChange(change);
        }
    }

    private onFilesRenamed(event: vscode.FileRenameEvent): void {
        for (const file of event.files) {
            const change: TrackedChange = {
                id: this.generateId(),
                type: 'file',
                uri: file.newUri.toString(),
                timestamp: Date.now(),
                data: {
                    changeType: 'renamed',
                    oldUri: file.oldUri.toString()
                }
            };
            this.addChange(change);
        }
    }

    private onEditorChange(editor: vscode.TextEditor | undefined): void {
        if (!editor) return;

        const change: TrackedChange = {
            id: this.generateId(),
            type: 'cursor',
            uri: editor.document.uri.toString(),
            timestamp: Date.now(),
            data: {
                fileName: editor.document.fileName,
                languageId: editor.document.languageId
            }
        };
        this.addChange(change);
    }

    private onSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
        const selection = event.selections[0];
        if (selection.isEmpty) return;

        const change: TrackedChange = {
            id: this.generateId(),
            type: 'selection',
            uri: event.textEditor.document.uri.toString(),
            timestamp: Date.now(),
            data: {
                start: { line: selection.start.line, character: selection.start.character },
                end: { line: selection.end.line, character: selection.end.character },
                text: event.textEditor.document.getText(selection).slice(0, 500)
            }
        };
        this.addChange(change);
    }

    private onDiagnosticsChange(event: vscode.DiagnosticChangeEvent): void {
        for (const uri of event.uris) {
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            
            if (errors.length > 0) {
                const change: TrackedChange = {
                    id: this.generateId(),
                    type: 'diagnostic',
                    uri: uri.toString(),
                    timestamp: Date.now(),
                    data: {
                        errorCount: errors.length,
                        errors: errors.slice(0, 5).map(e => ({
                            message: e.message,
                            line: e.range.start.line,
                            source: e.source
                        }))
                    }
                };
                this.addChange(change);
            }
        }
    }

    private addChange(change: TrackedChange): void {
        this.changes.push(change);
        if (this.changes.length > this.maxChanges) {
            this.changes.shift();
        }
        this.notifyCallbacks(change);
    }

    private notifyCallbacks(change: TrackedChange): void {
        for (const callback of this.onChangeCallbacks) {
            try {
                callback(change);
            } catch {
                // Ignore callback errors
            }
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    onChange(callback: (change: TrackedChange) => void): vscode.Disposable {
        this.onChangeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onChangeCallbacks.indexOf(callback);
            if (index >= 0) {
                this.onChangeCallbacks.splice(index, 1);
            }
        });
    }

    getRecentChanges(count?: number): TrackedChange[] {
        const n = count || 20;
        return this.changes.slice(-n);
    }

    getChangesByType(type: TrackedChange['type']): TrackedChange[] {
        return this.changes.filter(c => c.type === type);
    }

    getChangesSince(timestamp: number): TrackedChange[] {
        return this.changes.filter(c => c.timestamp > timestamp);
    }

    getFileHistory(uri: string): TrackedChange[] {
        return this.changes.filter(c => c.uri === uri);
    }

    buildChangeSummary(): string {
        const recent = this.getRecentChanges(10);
        if (recent.length === 0) return 'No recent changes';

        const lines: string[] = ['Recent activity:'];
        for (const change of recent) {
            const time = new Date(change.timestamp).toLocaleTimeString();
            switch (change.type) {
                case 'file':
                    lines.push(`[${time}] File ${(change.data as FileChange).changeType}: ${change.uri}`);
                    break;
                case 'selection':
                    lines.push(`[${time}] Selection in ${change.uri}`);
                    break;
                case 'diagnostic':
                    lines.push(`[${time}] Diagnostics changed in ${change.uri}`);
                    break;
            }
        }
        return lines.join('\n');
    }

    clear(): void {
        this.changes = [];
        this.fileContents.clear();
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
        this.onChangeCallbacks = [];
    }
}
