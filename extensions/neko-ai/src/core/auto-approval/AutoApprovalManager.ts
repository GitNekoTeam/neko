import * as vscode from 'vscode';

export interface ApprovalRule {
    id: string;
    type: 'tool' | 'command' | 'file' | 'pattern';
    value: string;
    action: 'allow' | 'deny' | 'ask';
    description?: string;
}

export interface ApprovalRequest {
    type: 'tool' | 'command' | 'file';
    name: string;
    args?: Record<string, unknown>;
    context?: string;
}

export interface ApprovalResult {
    approved: boolean;
    rule?: ApprovalRule;
    reason?: string;
}

export class AutoApprovalManager {
    private rules: ApprovalRule[] = [];
    private sessionApprovals: Map<string, boolean> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadRules();
    }

    private async loadRules(): Promise<void> {
        const savedRules = this.context.globalState.get<ApprovalRule[]>('autoApprovalRules');
        if (savedRules) {
            this.rules = savedRules;
        } else {
            this.rules = this.getDefaultRules();
        }
    }

    private getDefaultRules(): ApprovalRule[] {
        return [
            { id: 'read-file', type: 'tool', value: 'read_file', action: 'allow', description: 'Allow reading files' },
            { id: 'list-files', type: 'tool', value: 'list_files', action: 'allow', description: 'Allow listing files' },
            { id: 'search-files', type: 'tool', value: 'search_files', action: 'allow', description: 'Allow searching files' },
            { id: 'write-file', type: 'tool', value: 'write_file', action: 'ask', description: 'Ask before writing files' },
            { id: 'execute-command', type: 'tool', value: 'execute_command', action: 'ask', description: 'Ask before executing commands' },
            { id: 'dangerous-commands', type: 'pattern', value: 'rm -rf|sudo|chmod|chown', action: 'deny', description: 'Deny dangerous commands' },
            { id: 'system-files', type: 'pattern', value: '/etc/|/usr/|/bin/', action: 'deny', description: 'Deny system file access' }
        ];
    }

    async checkApproval(request: ApprovalRequest): Promise<ApprovalResult> {
        const key = this.getRequestKey(request);
        if (this.sessionApprovals.has(key)) {
            return { approved: this.sessionApprovals.get(key)!, reason: 'Session approval' };
        }

        for (const rule of this.rules) {
            if (this.matchesRule(request, rule)) {
                if (rule.action === 'allow') {
                    return { approved: true, rule, reason: rule.description };
                }
                if (rule.action === 'deny') {
                    return { approved: false, rule, reason: rule.description };
                }
                if (rule.action === 'ask') {
                    return this.askUser(request, rule);
                }
            }
        }

        return this.askUser(request);
    }

    private matchesRule(request: ApprovalRequest, rule: ApprovalRule): boolean {
        if (rule.type === 'pattern') {
            const pattern = new RegExp(rule.value, 'i');
            const testValue = request.name + (request.args ? JSON.stringify(request.args) : '');
            return pattern.test(testValue);
        }

        if (rule.type === request.type && rule.value === request.name) {
            return true;
        }

        return false;
    }

    private async askUser(request: ApprovalRequest, rule?: ApprovalRule): Promise<ApprovalResult> {
        const message = this.formatRequestMessage(request);
        const options = ['Allow', 'Allow for Session', 'Deny', 'Deny for Session'];
        
        const result = await vscode.window.showWarningMessage(message, ...options);
        const key = this.getRequestKey(request);

        switch (result) {
            case 'Allow':
                return { approved: true, rule, reason: 'User approved' };
            case 'Allow for Session':
                this.sessionApprovals.set(key, true);
                return { approved: true, rule, reason: 'User approved for session' };
            case 'Deny':
                return { approved: false, rule, reason: 'User denied' };
            case 'Deny for Session':
                this.sessionApprovals.set(key, false);
                return { approved: false, rule, reason: 'User denied for session' };
            default:
                return { approved: false, rule, reason: 'User cancelled' };
        }
    }

    private formatRequestMessage(request: ApprovalRequest): string {
        let message = `Neko AI wants to ${request.type}: ${request.name}`;
        if (request.args) {
            const argsStr = JSON.stringify(request.args, null, 2);
            if (argsStr.length < 200) {
                message += `\nArgs: ${argsStr}`;
            }
        }
        return message;
    }

    private getRequestKey(request: ApprovalRequest): string {
        return `${request.type}:${request.name}`;
    }

    addRule(rule: ApprovalRule): void {
        const existingIndex = this.rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            this.rules[existingIndex] = rule;
        } else {
            this.rules.push(rule);
        }
        this.saveRules();
    }

    removeRule(ruleId: string): void {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        this.saveRules();
    }

    getRules(): ApprovalRule[] {
        return [...this.rules];
    }

    private async saveRules(): Promise<void> {
        await this.context.globalState.update('autoApprovalRules', this.rules);
    }

    clearSessionApprovals(): void {
        this.sessionApprovals.clear();
    }

    resetToDefaults(): void {
        this.rules = this.getDefaultRules();
        this.saveRules();
    }
}
