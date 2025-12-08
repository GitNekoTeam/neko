import * as vscode from 'vscode';
import * as path from 'path';

export interface ProtectionRule {
    id: string;
    type: 'path' | 'pattern' | 'extension' | 'content';
    value: string;
    action: 'block' | 'warn' | 'readonly';
    description?: string;
}

export interface ProtectionCheckResult {
    allowed: boolean;
    rule?: ProtectionRule;
    reason?: string;
}

export class ProtectionManager {
    private rules: ProtectionRule[] = [];
    private context: vscode.ExtensionContext;
    private workspaceRoot: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.loadDefaultRules();
        this.loadSavedRules();
    }

    private loadDefaultRules(): void {
        this.rules = [
            { id: 'system-etc', type: 'path', value: '/etc/', action: 'block', description: 'System configuration' },
            { id: 'system-usr', type: 'path', value: '/usr/', action: 'block', description: 'System binaries' },
            { id: 'system-bin', type: 'path', value: '/bin/', action: 'block', description: 'System binaries' },
            { id: 'system-sbin', type: 'path', value: '/sbin/', action: 'block', description: 'System binaries' },
            { id: 'windows-system', type: 'path', value: 'C:\\Windows\\', action: 'block', description: 'Windows system' },
            { id: 'windows-program', type: 'path', value: 'C:\\Program Files\\', action: 'block', description: 'Program files' },
            { id: 'home-ssh', type: 'pattern', value: '.ssh', action: 'block', description: 'SSH keys' },
            { id: 'home-gnupg', type: 'pattern', value: '.gnupg', action: 'block', description: 'GPG keys' },
            { id: 'env-files', type: 'pattern', value: '.env', action: 'warn', description: 'Environment files' },
            { id: 'credentials', type: 'pattern', value: 'credentials', action: 'warn', description: 'Credential files' },
            { id: 'secrets', type: 'pattern', value: 'secret', action: 'warn', description: 'Secret files' },
            { id: 'private-keys', type: 'extension', value: '.pem', action: 'block', description: 'Private keys' },
            { id: 'private-keys-key', type: 'extension', value: '.key', action: 'block', description: 'Private keys' },
            { id: 'certificates', type: 'extension', value: '.p12', action: 'block', description: 'Certificates' },
            { id: 'keystore', type: 'extension', value: '.jks', action: 'block', description: 'Java keystore' },
            { id: 'api-keys', type: 'content', value: 'api[_-]?key', action: 'warn', description: 'API keys in content' },
            { id: 'passwords', type: 'content', value: 'password\\s*=', action: 'warn', description: 'Passwords in content' },
            { id: 'tokens', type: 'content', value: 'token\\s*=', action: 'warn', description: 'Tokens in content' }
        ];
    }

    private async loadSavedRules(): Promise<void> {
        const savedRules = this.context.globalState.get<ProtectionRule[]>('protectionRules');
        if (savedRules) {
            for (const rule of savedRules) {
                const existingIndex = this.rules.findIndex(r => r.id === rule.id);
                if (existingIndex >= 0) {
                    this.rules[existingIndex] = rule;
                } else {
                    this.rules.push(rule);
                }
            }
        }
    }

    async checkPath(filePath: string): Promise<ProtectionCheckResult> {
        const normalizedPath = path.normalize(filePath);
        const relativePath = this.getRelativePath(normalizedPath);
        const extension = path.extname(normalizedPath);
        const fileName = path.basename(normalizedPath);

        for (const rule of this.rules) {
            let matches = false;

            switch (rule.type) {
                case 'path':
                    matches = normalizedPath.toLowerCase().includes(rule.value.toLowerCase());
                    break;
                case 'pattern':
                    matches = new RegExp(rule.value, 'i').test(relativePath) ||
                              new RegExp(rule.value, 'i').test(fileName);
                    break;
                case 'extension':
                    matches = extension.toLowerCase() === rule.value.toLowerCase();
                    break;
            }

            if (matches) {
                if (rule.action === 'block') {
                    return { allowed: false, rule, reason: rule.description };
                }
                if (rule.action === 'warn') {
                    const proceed = await this.showWarning(filePath, rule);
                    return { allowed: proceed, rule, reason: proceed ? 'User approved' : 'User denied' };
                }
                if (rule.action === 'readonly') {
                    return { allowed: true, rule, reason: 'Read-only access' };
                }
            }
        }

        return { allowed: true };
    }

    async checkContent(content: string, filePath?: string): Promise<ProtectionCheckResult> {
        for (const rule of this.rules) {
            if (rule.type !== 'content') continue;

            const pattern = new RegExp(rule.value, 'i');
            if (pattern.test(content)) {
                if (rule.action === 'block') {
                    return { allowed: false, rule, reason: rule.description };
                }
                if (rule.action === 'warn') {
                    const proceed = await this.showContentWarning(rule, filePath);
                    return { allowed: proceed, rule, reason: proceed ? 'User approved' : 'User denied' };
                }
            }
        }

        return { allowed: true };
    }

    async checkCommand(command: string): Promise<ProtectionCheckResult> {
        const dangerousPatterns = [
            { pattern: /rm\s+-rf\s+[/~]/, reason: 'Dangerous recursive delete' },
            { pattern: /sudo\s+/, reason: 'Elevated privileges' },
            { pattern: /chmod\s+777/, reason: 'Insecure permissions' },
            { pattern: />\s*\/dev/, reason: 'Device file access' },
            { pattern: /mkfs/, reason: 'Filesystem formatting' },
            { pattern: /dd\s+if=/, reason: 'Low-level disk operation' },
            { pattern: /:(){ :|:& };:/, reason: 'Fork bomb' },
            { pattern: /curl.*\|\s*(ba)?sh/, reason: 'Remote script execution' },
            { pattern: /wget.*\|\s*(ba)?sh/, reason: 'Remote script execution' }
        ];

        for (const { pattern, reason } of dangerousPatterns) {
            if (pattern.test(command)) {
                const proceed = await vscode.window.showWarningMessage(
                    `Potentially dangerous command detected: ${reason}\n\nCommand: ${command.slice(0, 100)}`,
                    'Allow', 'Block'
                );
                return {
                    allowed: proceed === 'Allow',
                    reason: proceed === 'Allow' ? 'User approved dangerous command' : reason
                };
            }
        }

        return { allowed: true };
    }

    private async showWarning(filePath: string, rule: ProtectionRule): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            `Protected file access: ${rule.description}\n\nFile: ${filePath}`,
            'Allow', 'Block'
        );
        return result === 'Allow';
    }

    private async showContentWarning(rule: ProtectionRule, filePath?: string): Promise<boolean> {
        const message = filePath
            ? `Sensitive content detected in ${filePath}: ${rule.description}`
            : `Sensitive content detected: ${rule.description}`;
        
        const result = await vscode.window.showWarningMessage(message, 'Allow', 'Block');
        return result === 'Allow';
    }

    private getRelativePath(filePath: string): string {
        if (this.workspaceRoot && filePath.startsWith(this.workspaceRoot)) {
            return filePath.slice(this.workspaceRoot.length + 1);
        }
        return filePath;
    }

    addRule(rule: ProtectionRule): void {
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

    getRules(): ProtectionRule[] {
        return [...this.rules];
    }

    private async saveRules(): Promise<void> {
        const customRules = this.rules.filter(r => !this.isDefaultRule(r.id));
        await this.context.globalState.update('protectionRules', customRules);
    }

    private isDefaultRule(ruleId: string): boolean {
        const defaultIds = [
            'system-etc', 'system-usr', 'system-bin', 'system-sbin',
            'windows-system', 'windows-program', 'home-ssh', 'home-gnupg',
            'env-files', 'credentials', 'secrets', 'private-keys',
            'private-keys-key', 'certificates', 'keystore',
            'api-keys', 'passwords', 'tokens'
        ];
        return defaultIds.includes(ruleId);
    }

    resetToDefaults(): void {
        this.rules = [];
        this.loadDefaultRules();
        this.context.globalState.update('protectionRules', undefined);
    }
}
