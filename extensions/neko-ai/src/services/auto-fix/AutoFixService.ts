import * as vscode from 'vscode';
import {
    AutoFixConfig,
    CodeFixRequest,
    CodeFixResult,
    DiagnosticInfo,
    FixEvent,
    FixEventCallback,
    LLMFixProvider
} from './types';

const DEFAULT_CONFIG: AutoFixConfig = {
    enabled: false,
    debounceMs: 500,
    severityThreshold: vscode.DiagnosticSeverity.Error,
    excludePatterns: ['node_modules/**', 'dist/**', '*.min.js'],
    includeWarnings: false,
    autoApply: false,
    maxConcurrentFixes: 1
};

export class AutoFixService implements vscode.Disposable {
    private config: AutoFixConfig;
    private llmProvider?: LLMFixProvider;
    private disposables: vscode.Disposable[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private activeFixing: Set<string> = new Set();
    private eventListeners: Set<FixEventCallback> = new Set();
    private isWatching = false;

    constructor(private context: vscode.ExtensionContext) {
        this.config = this.loadConfig();
        this.setupConfigListener();
    }

    private loadConfig(): AutoFixConfig {
        const config = vscode.workspace.getConfiguration('neko.autoFix');
        return {
            enabled: config.get('enabled', DEFAULT_CONFIG.enabled),
            debounceMs: config.get('debounceMs', DEFAULT_CONFIG.debounceMs),
            severityThreshold: config.get('severityThreshold', DEFAULT_CONFIG.severityThreshold),
            excludePatterns: config.get('excludePatterns', DEFAULT_CONFIG.excludePatterns),
            includeWarnings: config.get('includeWarnings', DEFAULT_CONFIG.includeWarnings),
            autoApply: config.get('autoApply', DEFAULT_CONFIG.autoApply),
            maxConcurrentFixes: config.get('maxConcurrentFixes', DEFAULT_CONFIG.maxConcurrentFixes)
        };
    }

    private setupConfigListener(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('neko.autoFix')) {
                    this.config = this.loadConfig();
                    if (this.config.enabled && !this.isWatching) {
                        this.startWatching();
                    } else if (!this.config.enabled && this.isWatching) {
                        this.stopWatching();
                    }
                }
            })
        );
    }

    public setLLMProvider(provider: LLMFixProvider): void {
        this.llmProvider = provider;
    }

    public isEnabled(): boolean {
        return this.config.enabled;
    }

    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        vscode.workspace.getConfiguration('neko.autoFix').update('enabled', enabled, true);
        
        if (enabled) {
            this.startWatching();
        } else {
            this.stopWatching();
        }
    }

    public onFixEvent(callback: FixEventCallback): vscode.Disposable {
        this.eventListeners.add(callback);
        return new vscode.Disposable(() => {
            this.eventListeners.delete(callback);
        });
    }

    private emitEvent(event: FixEvent): void {
        this.eventListeners.forEach(cb => cb(event));
    }

    public startWatching(): void {
        if (this.isWatching) return;
        this.isWatching = true;

        const diagnosticListener = vscode.languages.onDidChangeDiagnostics(e => {
            if (!this.config.enabled) return;

            for (const uri of e.uris) {
                this.handleDiagnosticChange(uri);
            }
        });

        this.disposables.push(diagnosticListener);
    }

    public stopWatching(): void {
        this.isWatching = false;
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.activeFixing.clear();
    }

    private handleDiagnosticChange(uri: vscode.Uri): void {
        const filePath = uri.fsPath;

        if (this.shouldExclude(filePath)) return;
        if (this.activeFixing.has(filePath)) return;
        if (this.activeFixing.size >= this.config.maxConcurrentFixes) return;

        const existingTimer = this.debounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            this.processFile(uri);
        }, this.config.debounceMs);

        this.debounceTimers.set(filePath, timer);
    }

    private shouldExclude(filePath: string): boolean {
        return this.config.excludePatterns.some(pattern => {
            const regex = new RegExp(
                pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*\*/g, '.*')
                    .replace(/\*/g, '[^/]*')
            );
            return regex.test(filePath);
        });
    }

    private async processFile(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        const diagnostics = this.getRelevantDiagnostics(uri);

        if (diagnostics.length === 0) return;
        if (!this.llmProvider) return;

        this.activeFixing.add(filePath);
        this.emitEvent({
            type: 'started',
            file: filePath,
            diagnosticCount: diagnostics.length
        });

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const code = document.getText();
            const language = document.languageId;

            const request: CodeFixRequest = {
                file: filePath,
                code,
                diagnostics,
                language
            };

            this.emitEvent({
                type: 'fixing',
                file: filePath,
                diagnosticCount: diagnostics.length,
                message: `Fixing ${diagnostics.length} error(s)...`
            });

            const fixedCode = await this.llmProvider.generateFix(request);

            if (fixedCode && fixedCode !== code) {
                if (this.config.autoApply) {
                    await this.applyFix(uri, fixedCode);
                    this.emitEvent({
                        type: 'fixed',
                        file: filePath,
                        diagnosticCount: diagnostics.length,
                        message: 'Fix applied'
                    });
                } else {
                    await this.showFixPreview(uri, code, fixedCode, diagnostics);
                }
            }
        } catch (error) {
            this.emitEvent({
                type: 'failed',
                file: filePath,
                diagnosticCount: diagnostics.length,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            this.activeFixing.delete(filePath);
        }
    }

    private getRelevantDiagnostics(uri: vscode.Uri): DiagnosticInfo[] {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        
        return diagnostics
            .filter(d => {
                if (d.severity > this.config.severityThreshold) return false;
                if (!this.config.includeWarnings && d.severity === vscode.DiagnosticSeverity.Warning) {
                    return false;
                }
                return true;
            })
            .map(d => this.convertDiagnostic(uri.fsPath, d));
    }

    private convertDiagnostic(file: string, d: vscode.Diagnostic): DiagnosticInfo {
        return {
            file,
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            endLine: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            message: d.message,
            severity: d.severity,
            code: typeof d.code === 'object' ? d.code.value : d.code,
            source: d.source,
            range: d.range
        };
    }

    private async applyFix(uri: vscode.Uri, fixedCode: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(uri, fullRange, fixedCode);
        await vscode.workspace.applyEdit(edit);
        await document.save();
    }

    private async showFixPreview(
        uri: vscode.Uri,
        originalCode: string,
        fixedCode: string,
        diagnostics: DiagnosticInfo[]
    ): Promise<void> {
        const errorSummary = diagnostics.slice(0, 3).map(d => 
            `Line ${d.line}: ${d.message}`
        ).join('\n');

        const choice = await vscode.window.showInformationMessage(
            `Found ${diagnostics.length} error(s). Apply fix?`,
            { modal: false, detail: errorSummary },
            'Apply',
            'Preview',
            'Dismiss'
        );

        if (choice === 'Apply') {
            await this.applyFix(uri, fixedCode);
            this.emitEvent({
                type: 'fixed',
                file: uri.fsPath,
                diagnosticCount: diagnostics.length,
                message: 'Fix applied by user'
            });
        } else if (choice === 'Preview') {
            await this.showDiff(uri, originalCode, fixedCode);
        }
    }

    private async showDiff(uri: vscode.Uri, original: string, fixed: string): Promise<void> {
        const originalUri = uri.with({ scheme: 'neko-original' });
        const fixedUri = uri.with({ scheme: 'neko-fixed' });

        const provider = new (class implements vscode.TextDocumentContentProvider {
            private content: Map<string, string> = new Map();

            setContent(uri: vscode.Uri, content: string): void {
                this.content.set(uri.toString(), content);
            }

            provideTextDocumentContent(uri: vscode.Uri): string {
                return this.content.get(uri.toString()) || '';
            }
        })();

        provider.setContent(originalUri, original);
        provider.setContent(fixedUri, fixed);

        const disposable = vscode.workspace.registerTextDocumentContentProvider('neko-original', provider);
        this.disposables.push(disposable);
        
        const disposable2 = vscode.workspace.registerTextDocumentContentProvider('neko-fixed', provider);
        this.disposables.push(disposable2);

        await vscode.commands.executeCommand('vscode.diff', originalUri, fixedUri, 'Original <-> Fixed');
    }

    public async fixCurrentFile(): Promise<CodeFixResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                success: false,
                appliedFixes: 0,
                remainingErrors: 0,
                message: 'No active editor'
            };
        }

        const uri = editor.document.uri;
        const diagnostics = this.getRelevantDiagnostics(uri);

        if (diagnostics.length === 0) {
            return {
                success: true,
                appliedFixes: 0,
                remainingErrors: 0,
                message: 'No errors to fix'
            };
        }

        if (!this.llmProvider) {
            return {
                success: false,
                appliedFixes: 0,
                remainingErrors: diagnostics.length,
                message: 'LLM provider not configured'
            };
        }

        const code = editor.document.getText();
        const request: CodeFixRequest = {
            file: uri.fsPath,
            code,
            diagnostics,
            language: editor.document.languageId
        };

        try {
            const fixedCode = await this.llmProvider.generateFix(request);
            
            if (fixedCode && fixedCode !== code) {
                await this.applyFix(uri, fixedCode);
                
                await new Promise(resolve => setTimeout(resolve, 200));
                const remaining = this.getRelevantDiagnostics(uri);

                return {
                    success: remaining.length === 0,
                    fixedCode,
                    appliedFixes: diagnostics.length - remaining.length,
                    remainingErrors: remaining.length,
                    message: remaining.length === 0 
                        ? 'All errors fixed' 
                        : `Fixed ${diagnostics.length - remaining.length}, ${remaining.length} remaining`
                };
            }

            return {
                success: false,
                appliedFixes: 0,
                remainingErrors: diagnostics.length,
                message: 'No fix generated'
            };
        } catch (error) {
            return {
                success: false,
                appliedFixes: 0,
                remainingErrors: diagnostics.length,
                message: error instanceof Error ? error.message : 'Fix failed'
            };
        }
    }

    public dispose(): void {
        this.stopWatching();
        this.disposables.forEach(d => d.dispose());
        this.eventListeners.clear();
    }
}
