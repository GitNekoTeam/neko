import * as vscode from 'vscode';

export interface DiagnosticInfo {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    source?: string;
    code?: string | number;
}

export class DiagnosticsProvider implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];
    private diagnosticChangeEmitter = new vscode.EventEmitter<vscode.Uri[]>();

    readonly onDiagnosticsChanged = this.diagnosticChangeEmitter.event;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.setupListeners();
    }

    private setupListeners(): void {
        this.disposables.push(
            vscode.languages.onDidChangeDiagnostics((event: vscode.DiagnosticChangeEvent) => {
                this.diagnosticChangeEmitter.fire([...event.uris]);
            })
        );
    }

    getDiagnosticsForFile(uri: vscode.Uri): DiagnosticInfo[] {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        return diagnostics.map(d => this.convertDiagnostic(uri, d));
    }

    getDiagnosticsForWorkspace(): Map<string, DiagnosticInfo[]> {
        const allDiagnostics = vscode.languages.getDiagnostics();
        const result = new Map<string, DiagnosticInfo[]>();

        for (const [uri, diagnostics] of allDiagnostics) {
            if (diagnostics.length > 0) {
                result.set(uri.fsPath, diagnostics.map(d => this.convertDiagnostic(uri, d)));
            }
        }

        return result;
    }

    getErrorsForFile(uri: vscode.Uri): DiagnosticInfo[] {
        return this.getDiagnosticsForFile(uri).filter(d => d.severity === 'error');
    }

    getWarningsForFile(uri: vscode.Uri): DiagnosticInfo[] {
        return this.getDiagnosticsForFile(uri).filter(d => d.severity === 'warning');
    }

    getAllErrors(): DiagnosticInfo[] {
        const errors: DiagnosticInfo[] = [];
        const allDiagnostics = vscode.languages.getDiagnostics();

        for (const [uri, diagnostics] of allDiagnostics) {
            for (const d of diagnostics) {
                if (d.severity === vscode.DiagnosticSeverity.Error) {
                    errors.push(this.convertDiagnostic(uri, d));
                }
            }
        }

        return errors;
    }

    formatDiagnosticsForPrompt(diagnostics: DiagnosticInfo[]): string {
        if (diagnostics.length === 0) {
            return 'No diagnostics found.';
        }

        let output = `Found ${diagnostics.length} diagnostic(s):\n\n`;

        const grouped = new Map<string, DiagnosticInfo[]>();
        for (const d of diagnostics) {
            const existing = grouped.get(d.file) || [];
            existing.push(d);
            grouped.set(d.file, existing);
        }

        for (const [file, fileDiagnostics] of grouped) {
            output += `**${file}**\n`;
            for (const d of fileDiagnostics) {
                const icon = this.getSeverityIcon(d.severity);
                output += `  ${icon} Line ${d.line}: ${d.message}`;
                if (d.source) {
                    output += ` [${d.source}]`;
                }
                output += '\n';
            }
            output += '\n';
        }

        return output;
    }

    async getProblemsContext(maxProblems = 10): Promise<string> {
        const errors = this.getAllErrors();
        const warnings = this.getDiagnosticsForWorkspace();
        
        let allProblems: DiagnosticInfo[] = [...errors];
        
        for (const [, diagnostics] of warnings) {
            for (const d of diagnostics) {
                if (d.severity === 'warning' && allProblems.length < maxProblems) {
                    allProblems.push(d);
                }
            }
        }

        allProblems = allProblems.slice(0, maxProblems);

        if (allProblems.length === 0) {
            return '';
        }

        return `\n\n## Current Problems\n\n${this.formatDiagnosticsForPrompt(allProblems)}`;
    }

    async getFileProblemsContext(uri: vscode.Uri): Promise<string> {
        const diagnostics = this.getDiagnosticsForFile(uri);
        
        if (diagnostics.length === 0) {
            return '';
        }

        return `\n\n## Problems in Current File\n\n${this.formatDiagnosticsForPrompt(diagnostics)}`;
    }

    private convertDiagnostic(uri: vscode.Uri, diagnostic: vscode.Diagnostic): DiagnosticInfo {
        return {
            file: uri.fsPath,
            line: diagnostic.range.start.line + 1,
            column: diagnostic.range.start.character + 1,
            message: diagnostic.message,
            severity: this.convertSeverity(diagnostic.severity),
            source: diagnostic.source,
            code: typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code
        };
    }

    private convertSeverity(severity: vscode.DiagnosticSeverity): DiagnosticInfo['severity'] {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'error';
            case vscode.DiagnosticSeverity.Warning:
                return 'warning';
            case vscode.DiagnosticSeverity.Information:
                return 'info';
            case vscode.DiagnosticSeverity.Hint:
                return 'hint';
            default:
                return 'info';
        }
    }

    private getSeverityIcon(severity: DiagnosticInfo['severity']): string {
        switch (severity) {
            case 'error':
                return '[ERROR]';
            case 'warning':
                return '[WARN]';
            case 'info':
                return '[INFO]';
            case 'hint':
                return '[HINT]';
            default:
                return '[?]';
        }
    }

    dispose(): void {
        this.diagnosticChangeEmitter.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
