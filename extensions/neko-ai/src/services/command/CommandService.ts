import * as vscode from 'vscode';

export interface CommandDefinition {
    id: string;
    title: string;
    category?: string;
    handler: (...args: unknown[]) => Promise<void> | void;
}

export interface CommandContext {
    extensionContext: vscode.ExtensionContext;
}

export class CommandService {
    private commands: Map<string, CommandDefinition> = new Map();
    private disposables: vscode.Disposable[] = [];
    private context: CommandContext;

    constructor(context: CommandContext) {
        this.context = context;
    }

    registerCommand(definition: CommandDefinition): void {
        if (this.commands.has(definition.id)) {
            console.warn(`Command ${definition.id} is already registered`);
            return;
        }

        this.commands.set(definition.id, definition);

        const disposable = vscode.commands.registerCommand(
            definition.id,
            async (...args: unknown[]) => {
                try {
                    await definition.handler(...args);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Command failed: ${message}`);
                    console.error(`Command ${definition.id} failed:`, error);
                }
            }
        );

        this.disposables.push(disposable);
        this.context.extensionContext.subscriptions.push(disposable);
    }

    registerCommands(definitions: CommandDefinition[]): void {
        for (const definition of definitions) {
            this.registerCommand(definition);
        }
    }

    async executeCommand<T>(commandId: string, ...args: unknown[]): Promise<T | undefined> {
        return vscode.commands.executeCommand<T>(commandId, ...args);
    }

    hasCommand(commandId: string): boolean {
        return this.commands.has(commandId);
    }

    getCommand(commandId: string): CommandDefinition | undefined {
        return this.commands.get(commandId);
    }

    getAllCommands(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.commands.clear();
    }
}

export const BUILT_IN_COMMANDS = {
    OPEN_CHAT: 'neko.openChat',
    NEW_TASK: 'neko.newTask',
    CANCEL_TASK: 'neko.cancelTask',
    RETRY_TASK: 'neko.retryTask',
    CLEAR_HISTORY: 'neko.clearHistory',
    EXPORT_HISTORY: 'neko.exportHistory',
    OPEN_SETTINGS: 'neko.openSettings',
    SELECT_MODEL: 'neko.selectModel',
    TOGGLE_AUTO_APPROVE: 'neko.toggleAutoApprove',
    SHOW_CONTEXT: 'neko.showContext',
    ADD_FILE_TO_CONTEXT: 'neko.addFileToContext',
    ADD_FOLDER_TO_CONTEXT: 'neko.addFolderToContext',
    CLEAR_CONTEXT: 'neko.clearContext'
} as const;

export function createBuiltInCommands(
    handlers: Partial<Record<keyof typeof BUILT_IN_COMMANDS, () => Promise<void> | void>>
): CommandDefinition[] {
    const definitions: CommandDefinition[] = [];

    for (const [key, commandId] of Object.entries(BUILT_IN_COMMANDS)) {
        const handler = handlers[key as keyof typeof BUILT_IN_COMMANDS];
        if (handler) {
            definitions.push({
                id: commandId,
                title: formatCommandTitle(key),
                category: 'Neko',
                handler
            });
        }
    }

    return definitions;
}

function formatCommandTitle(key: string): string {
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
