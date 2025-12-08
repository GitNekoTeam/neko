import * as vscode from 'vscode';

export interface DiagnosticInfo {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string | number;
    source?: string;
    range: vscode.Range;
}

export interface CodeFixRequest {
    file: string;
    code: string;
    diagnostics: DiagnosticInfo[];
    language: string;
}

export interface CodeFixResult {
    success: boolean;
    fixedCode?: string;
    appliedFixes: number;
    remainingErrors: number;
    message: string;
}

export interface AutoFixConfig {
    enabled: boolean;
    debounceMs: number;
    severityThreshold: vscode.DiagnosticSeverity;
    excludePatterns: string[];
    includeWarnings: boolean;
    autoApply: boolean;
    maxConcurrentFixes: number;
}

export interface FixEvent {
    type: 'started' | 'fixing' | 'fixed' | 'failed' | 'cancelled';
    file: string;
    diagnosticCount: number;
    message?: string;
}

export type FixEventCallback = (event: FixEvent) => void;

export interface LLMFixProvider {
    generateFix(request: CodeFixRequest): Promise<string>;
}
