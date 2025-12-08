import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectRules {
    systemPrompt?: string;
    codeStyle?: {
        language?: string;
        indentation?: 'tabs' | 'spaces';
        indentSize?: number;
        quotes?: 'single' | 'double';
        semicolons?: boolean;
    };
    conventions?: string[];
    ignorePaths?: string[];
    preferredLibraries?: string[];
    testingFramework?: string;
    documentation?: {
        style?: 'jsdoc' | 'tsdoc' | 'docstring' | 'none';
        required?: boolean;
    };
    customInstructions?: string;
}

export class RulesManager {
    private outputChannel: vscode.OutputChannel;
    private rules: ProjectRules | null = null;
    private rulesWatcher: vscode.FileSystemWatcher | null = null;
    private readonly rulesFileNames = ['.nekorules', '.neko-rules', 'neko.rules.json', '.cursorrules'];

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    async initialize(): Promise<void> {
        await this.loadRules();
        this.setupWatcher();
    }

    private setupWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const patterns = this.rulesFileNames.map(name => 
            new vscode.RelativePattern(workspaceFolder, name)
        );

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            watcher.onDidChange(() => this.loadRules());
            watcher.onDidCreate(() => this.loadRules());
            watcher.onDidDelete(() => this.loadRules());
        }
    }

    async loadRules(): Promise<ProjectRules | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;

        for (const fileName of this.rulesFileNames) {
            const rulesPath = path.join(workspaceFolder.uri.fsPath, fileName);
            const rulesUri = vscode.Uri.file(rulesPath);

            try {
                const content = await vscode.workspace.fs.readFile(rulesUri);
                const text = Buffer.from(content).toString('utf-8');

                if (fileName.endsWith('.json')) {
                    this.rules = JSON.parse(text);
                } else {
                    this.rules = this.parseTextRules(text);
                }

                this.outputChannel.appendLine(`Loaded rules from ${fileName}`);
                return this.rules;
            } catch {
                continue;
            }
        }

        this.rules = null;
        return null;
    }

    private parseTextRules(text: string): ProjectRules {
        const rules: ProjectRules = {};
        const lines = text.split('\n');
        let currentSection = '';
        let sectionContent: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('# ')) {
                if (currentSection && sectionContent.length > 0) {
                    this.applySection(rules, currentSection, sectionContent.join('\n'));
                }
                currentSection = trimmed.substring(2).toLowerCase();
                sectionContent = [];
            } else if (trimmed && !trimmed.startsWith('//')) {
                sectionContent.push(line);
            }
        }

        if (currentSection && sectionContent.length > 0) {
            this.applySection(rules, currentSection, sectionContent.join('\n'));
        }

        if (!currentSection && lines.length > 0) {
            rules.customInstructions = text;
        }

        return rules;
    }

    private applySection(rules: ProjectRules, section: string, content: string): void {
        switch (section) {
            case 'system prompt':
            case 'systemprompt':
                rules.systemPrompt = content.trim();
                break;
            case 'conventions':
            case 'rules':
                rules.conventions = content.split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('-'))
                    .map(l => l.replace(/^[-*]\s*/, ''));
                break;
            case 'ignore':
            case 'ignore paths':
                rules.ignorePaths = content.split('\n')
                    .map(l => l.trim())
                    .filter(l => l);
                break;
            case 'libraries':
            case 'preferred libraries':
                rules.preferredLibraries = content.split('\n')
                    .map(l => l.trim())
                    .filter(l => l);
                break;
            case 'testing':
                rules.testingFramework = content.trim();
                break;
            case 'instructions':
            case 'custom instructions':
                rules.customInstructions = content.trim();
                break;
            default:
                if (!rules.customInstructions) {
                    rules.customInstructions = '';
                }
                rules.customInstructions += `\n\n${section}:\n${content}`;
        }
    }

    getRules(): ProjectRules | null {
        return this.rules;
    }

    buildRulesPrompt(): string {
        if (!this.rules) return '';

        const parts: string[] = [];

        if (this.rules.systemPrompt) {
            parts.push(this.rules.systemPrompt);
        }

        if (this.rules.conventions && this.rules.conventions.length > 0) {
            parts.push('Code conventions to follow:');
            parts.push(this.rules.conventions.map(c => `- ${c}`).join('\n'));
        }

        if (this.rules.codeStyle) {
            const style = this.rules.codeStyle;
            const styleRules: string[] = [];
            
            if (style.indentation) {
                styleRules.push(`Use ${style.indentation}${style.indentSize ? ` (${style.indentSize} spaces)` : ''} for indentation`);
            }
            if (style.quotes) {
                styleRules.push(`Use ${style.quotes} quotes`);
            }
            if (style.semicolons !== undefined) {
                styleRules.push(style.semicolons ? 'Use semicolons' : 'Omit semicolons');
            }

            if (styleRules.length > 0) {
                parts.push('Code style:');
                parts.push(styleRules.map(r => `- ${r}`).join('\n'));
            }
        }

        if (this.rules.preferredLibraries && this.rules.preferredLibraries.length > 0) {
            parts.push(`Preferred libraries: ${this.rules.preferredLibraries.join(', ')}`);
        }

        if (this.rules.testingFramework) {
            parts.push(`Testing framework: ${this.rules.testingFramework}`);
        }

        if (this.rules.documentation) {
            if (this.rules.documentation.style) {
                parts.push(`Documentation style: ${this.rules.documentation.style}`);
            }
            if (this.rules.documentation.required) {
                parts.push('Documentation is required for all public APIs');
            }
        }

        if (this.rules.customInstructions) {
            parts.push('Additional instructions:');
            parts.push(this.rules.customInstructions);
        }

        return parts.join('\n\n');
    }

    async createDefaultRulesFile(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const defaultRules = `# System Prompt
You are an AI coding assistant for this project. Follow the conventions and guidelines below.

# Conventions
- Write clean, readable code
- Add comments for complex logic
- Follow existing code patterns in the project
- Use meaningful variable and function names

# Preferred Libraries
# Add your preferred libraries here

# Testing
# Specify your testing framework (e.g., vitest, jest, pytest)

# Custom Instructions
# Add any additional instructions for the AI here
`;

        const rulesPath = path.join(workspaceFolder.uri.fsPath, '.nekorules');
        const rulesUri = vscode.Uri.file(rulesPath);

        try {
            await vscode.workspace.fs.writeFile(rulesUri, Buffer.from(defaultRules, 'utf-8'));
            const document = await vscode.workspace.openTextDocument(rulesUri);
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage('Created .nekorules file');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create rules file: ${error}`);
        }
    }

    dispose(): void {
        this.rulesWatcher?.dispose();
    }
}
