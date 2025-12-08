import * as vscode from 'vscode';

export interface SlashCommand {
    name: string;
    description: string;
    aliases?: string[];
    execute: (args: string, context: SlashCommandContext) => Promise<SlashCommandResult>;
}

export interface SlashCommandContext {
    workspaceFolder?: vscode.WorkspaceFolder;
    activeEditor?: vscode.TextEditor;
    selection?: string;
    outputChannel: vscode.OutputChannel;
}

export interface SlashCommandResult {
    content: string;
    shouldSend?: boolean;
    files?: string[];
}

export class SlashCommandRegistry {
    private commands: Map<string, SlashCommand> = new Map();
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.registerBuiltinCommands();
    }

    private registerBuiltinCommands(): void {
        this.register({
            name: 'help',
            description: 'Show available slash commands',
            aliases: ['h', '?'],
            execute: async () => {
                const commands = this.getAll();
                let content = 'Available commands:\n\n';
                for (const cmd of commands) {
                    content += `**/${cmd.name}** - ${cmd.description}\n`;
                    if (cmd.aliases?.length) {
                        content += `  Aliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}\n`;
                    }
                }
                return { content, shouldSend: false };
            }
        });

        this.register({
            name: 'clear',
            description: 'Clear the chat history',
            aliases: ['cls'],
            execute: async () => {
                return { content: '__CLEAR_CHAT__', shouldSend: false };
            }
        });

        this.register({
            name: 'new',
            description: 'Start a new chat session',
            execute: async () => {
                return { content: '__NEW_CHAT__', shouldSend: false };
            }
        });

        this.register({
            name: 'file',
            description: 'Add a file to context',
            aliases: ['f'],
            execute: async (args, context) => {
                if (!args.trim()) {
                    return { content: 'Usage: /file <path>', shouldSend: false };
                }
                const filePath = args.trim();
                const workspacePath = context.workspaceFolder?.uri.fsPath;
                if (!workspacePath) {
                    return { content: 'No workspace folder open', shouldSend: false };
                }
                return { 
                    content: `Adding file to context: ${filePath}`,
                    files: [filePath],
                    shouldSend: false 
                };
            }
        });

        this.register({
            name: 'explain',
            description: 'Explain the selected code',
            aliases: ['e'],
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please explain this code:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'fix',
            description: 'Fix issues in the selected code',
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please fix any issues in this code:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'improve',
            description: 'Improve the selected code',
            aliases: ['optimize'],
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please improve this code:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'test',
            description: 'Generate tests for the selected code',
            aliases: ['tests'],
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please generate unit tests for this code:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'docs',
            description: 'Generate documentation for the selected code',
            aliases: ['doc', 'document'],
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please generate documentation for this code:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'refactor',
            description: 'Refactor the selected code',
            execute: async (_args, context) => {
                const selection = context.selection || context.activeEditor?.document.getText();
                if (!selection) {
                    return { content: 'No code selected', shouldSend: false };
                }
                return { 
                    content: `Please refactor this code to improve its structure:\n\n\`\`\`\n${selection}\n\`\`\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'search',
            description: 'Search the codebase',
            aliases: ['s', 'find'],
            execute: async (args) => {
                if (!args.trim()) {
                    return { content: 'Usage: /search <query>', shouldSend: false };
                }
                return { 
                    content: `Searching codebase for: ${args.trim()}`,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'run',
            description: 'Run a terminal command',
            aliases: ['exec', 'shell'],
            execute: async (args) => {
                if (!args.trim()) {
                    return { content: 'Usage: /run <command>', shouldSend: false };
                }
                return { 
                    content: `Please run this command: \`${args.trim()}\``,
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'commit',
            description: 'Generate a commit message for staged changes',
            execute: async () => {
                return { 
                    content: 'Please generate a commit message for the current staged changes.',
                    shouldSend: true 
                };
            }
        });

        this.register({
            name: 'model',
            description: 'Show or change the current model',
            execute: async (args) => {
                if (!args.trim()) {
                    return { content: '__SHOW_MODEL__', shouldSend: false };
                }
                return { content: `__SET_MODEL__:${args.trim()}`, shouldSend: false };
            }
        });

        this.register({
            name: 'provider',
            description: 'Show or change the current provider',
            execute: async (args) => {
                if (!args.trim()) {
                    return { content: '__SHOW_PROVIDER__', shouldSend: false };
                }
                return { content: `__SET_PROVIDER__:${args.trim()}`, shouldSend: false };
            }
        });
    }

    register(command: SlashCommand): void {
        this.commands.set(command.name, command);
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.commands.set(alias, command);
            }
        }
        this.outputChannel.appendLine(`Registered slash command: /${command.name}`);
    }

    unregister(name: string): boolean {
        const command = this.commands.get(name);
        if (command) {
            this.commands.delete(command.name);
            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.commands.delete(alias);
                }
            }
            return true;
        }
        return false;
    }

    get(name: string): SlashCommand | undefined {
        return this.commands.get(name);
    }

    getAll(): SlashCommand[] {
        const seen = new Set<string>();
        const commands: SlashCommand[] = [];
        for (const cmd of this.commands.values()) {
            if (!seen.has(cmd.name)) {
                seen.add(cmd.name);
                commands.push(cmd);
            }
        }
        return commands.sort((a, b) => a.name.localeCompare(b.name));
    }

    async execute(input: string, context: Omit<SlashCommandContext, 'outputChannel'>): Promise<SlashCommandResult | null> {
        if (!input.startsWith('/')) {
            return null;
        }

        const match = input.match(/^\/(\w+)(?:\s+(.*))?$/);
        if (!match) {
            return null;
        }

        const [, commandName, args = ''] = match;
        const command = this.commands.get(commandName.toLowerCase());

        if (!command) {
            return {
                content: `Unknown command: /${commandName}. Type /help for available commands.`,
                shouldSend: false
            };
        }

        try {
            return await command.execute(args, { ...context, outputChannel: this.outputChannel });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: `Error executing /${commandName}: ${message}`,
                shouldSend: false
            };
        }
    }

    getCompletions(prefix: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const searchPrefix = prefix.startsWith('/') ? prefix.slice(1).toLowerCase() : prefix.toLowerCase();

        for (const cmd of this.getAll()) {
            if (cmd.name.toLowerCase().startsWith(searchPrefix)) {
                const item = new vscode.CompletionItem(`/${cmd.name}`, vscode.CompletionItemKind.Function);
                item.detail = cmd.description;
                item.insertText = `/${cmd.name} `;
                items.push(item);
            }
        }

        return items;
    }
}
