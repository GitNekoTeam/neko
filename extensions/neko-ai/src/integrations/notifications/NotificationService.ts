import * as vscode from 'vscode';

export type NotificationType = 'info' | 'warning' | 'error' | 'progress';

export interface NotificationOptions {
    type: NotificationType;
    message: string;
    detail?: string;
    actions?: NotificationAction[];
    timeout?: number;
    progress?: boolean;
    cancellable?: boolean;
}

export interface NotificationAction {
    title: string;
    callback: () => void | Promise<void>;
}

export interface ProgressNotification {
    report: (progress: { message?: string; increment?: number }) => void;
    cancel: () => void;
}

export class NotificationService {
    private activeNotifications: Map<string, vscode.Disposable> = new Map();
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.outputChannel = vscode.window.createOutputChannel('Neko AI');
    }

    async show(options: NotificationOptions): Promise<string | undefined> {
        const { type, message, detail, actions, timeout } = options;
        const fullMessage = detail ? `${message}\n\n${detail}` : message;
        const actionTitles = actions?.map(a => a.title) || [];

        let result: string | undefined;

        switch (type) {
            case 'info':
                result = await vscode.window.showInformationMessage(fullMessage, ...actionTitles);
                break;
            case 'warning':
                result = await vscode.window.showWarningMessage(fullMessage, ...actionTitles);
                break;
            case 'error':
                result = await vscode.window.showErrorMessage(fullMessage, ...actionTitles);
                break;
        }

        if (result && actions) {
            const action = actions.find(a => a.title === result);
            if (action) {
                await action.callback();
            }
        }

        if (timeout && timeout > 0) {
            setTimeout(() => {
                // VS Code notifications auto-dismiss, this is for tracking
            }, timeout);
        }

        return result;
    }

    info(message: string, ...actions: string[]): Thenable<string | undefined> {
        return vscode.window.showInformationMessage(message, ...actions);
    }

    warning(message: string, ...actions: string[]): Thenable<string | undefined> {
        return vscode.window.showWarningMessage(message, ...actions);
    }

    error(message: string, ...actions: string[]): Thenable<string | undefined> {
        return vscode.window.showErrorMessage(message, ...actions);
    }

    async withProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>,
        cancellable: boolean = false
    ): Promise<T> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable
            },
            task
        );
    }

    async withStatusBarProgress<T>(
        message: string,
        task: () => Promise<T>
    ): Promise<T> {
        const originalText = this.statusBarItem.text;
        this.statusBarItem.text = `$(sync~spin) ${message}`;
        this.statusBarItem.show();

        try {
            return await task();
        } finally {
            this.statusBarItem.text = originalText;
            if (!originalText) {
                this.statusBarItem.hide();
            }
        }
    }

    setStatusBar(text: string, tooltip?: string, command?: string): void {
        this.statusBarItem.text = text;
        if (tooltip) {
            this.statusBarItem.tooltip = tooltip;
        }
        if (command) {
            this.statusBarItem.command = command;
        }
        this.statusBarItem.show();
    }

    hideStatusBar(): void {
        this.statusBarItem.hide();
    }

    log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const prefix = level.toUpperCase().padEnd(5);
        this.outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);
    }

    showOutput(): void {
        this.outputChannel.show();
    }

    clearOutput(): void {
        this.outputChannel.clear();
    }

    async confirm(message: string, confirmText: string = 'Yes', cancelText: string = 'No'): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            confirmText,
            cancelText
        );
        return result === confirmText;
    }

    async input(prompt: string, options?: {
        placeholder?: string;
        value?: string;
        password?: boolean;
        validateInput?: (value: string) => string | undefined;
    }): Promise<string | undefined> {
        return vscode.window.showInputBox({
            prompt,
            placeHolder: options?.placeholder,
            value: options?.value,
            password: options?.password,
            validateInput: options?.validateInput
        });
    }

    async quickPick<T extends vscode.QuickPickItem>(
        items: T[],
        options?: {
            title?: string;
            placeholder?: string;
            canPickMany?: boolean;
        }
    ): Promise<T | T[] | undefined> {
        if (options?.canPickMany) {
            return vscode.window.showQuickPick(items, {
                title: options?.title,
                placeHolder: options?.placeholder,
                canPickMany: true
            });
        }
        return vscode.window.showQuickPick(items, {
            title: options?.title,
            placeHolder: options?.placeholder
        });
    }

    toast(message: string, duration: number = 3000): void {
        const notification = vscode.window.setStatusBarMessage(message, duration);
        const id = Date.now().toString();
        this.activeNotifications.set(id, notification);
        
        setTimeout(() => {
            this.activeNotifications.delete(id);
        }, duration);
    }

    createProgressNotification(title: string): ProgressNotification {
        let resolveProgress: () => void;
        const progressPromise = new Promise<void>(resolve => {
            resolveProgress = resolve;
        });

        let progressReporter: vscode.Progress<{ message?: string; increment?: number }>;

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: true
            },
            (progress, _token) => {
                progressReporter = progress;
                return progressPromise;
            }
        );

        return {
            report: (value) => {
                if (progressReporter) {
                    progressReporter.report(value);
                }
            },
            cancel: () => {
                resolveProgress();
            }
        };
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        for (const notification of this.activeNotifications.values()) {
            notification.dispose();
        }
        this.activeNotifications.clear();
    }
}
