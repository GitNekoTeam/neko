import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

interface CommandExecution {
    id: string;
    command: string;
    output: string;
    exitCode: number | null;
    startTime: number;
    endTime?: number;
    process?: ChildProcess;
    isRunning: boolean;
}

export class TerminalService implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private timeout: number;
    private executions: Map<string, CommandExecution> = new Map();
    private terminal: vscode.Terminal | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(outputChannel: vscode.OutputChannel, timeout: number) {
        this.outputChannel = outputChannel;
        this.timeout = timeout * 1000;
        this.setupTerminalListener();
    }

    private setupTerminalListener(): void {
        this.disposables.push(
            vscode.window.onDidCloseTerminal((terminal: vscode.Terminal) => {
                if (terminal === this.terminal) {
                    this.terminal = undefined;
                }
            })
        );
    }

    private getOrCreateTerminal(): vscode.Terminal {
        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal({
                name: 'Neko AI',
                hideFromUser: false
            });
        }
        return this.terminal;
    }

    async executeCommand(
        command: string,
        cwd?: string,
        onOutput?: (data: string) => void
    ): Promise<CommandExecution> {
        const id = `exec_${Date.now()}`;
        const execution: CommandExecution = {
            id,
            command,
            output: '',
            exitCode: null,
            startTime: Date.now(),
            isRunning: true
        };

        this.executions.set(id, execution);
        this.outputChannel.appendLine(`Executing: ${command}`);

        return new Promise((resolve) => {
            const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
            const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

            const proc = spawn(shell, shellArgs, {
                cwd: cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                env: { ...process.env },
                shell: false
            });

            execution.process = proc;

            const timeoutId = setTimeout(() => {
                if (execution.isRunning) {
                    this.outputChannel.appendLine(`Command timed out after ${this.timeout / 1000}s: ${command}`);
                    proc.kill('SIGTERM');
                    setTimeout(() => {
                        if (execution.isRunning) {
                            proc.kill('SIGKILL');
                        }
                    }, 5000);
                }
            }, this.timeout);

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                execution.output += text;
                onOutput?.(text);
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                execution.output += text;
                onOutput?.(text);
            });

            proc.on('close', (code: number | null) => {
                clearTimeout(timeoutId);
                execution.exitCode = code;
                execution.endTime = Date.now();
                execution.isRunning = false;
                execution.process = undefined;

                this.outputChannel.appendLine(
                    `Command finished with code ${code}: ${command}`
                );

                resolve(execution);
            });

            proc.on('error', (error: Error) => {
                clearTimeout(timeoutId);
                execution.output += `\nError: ${error.message}`;
                execution.exitCode = -1;
                execution.endTime = Date.now();
                execution.isRunning = false;
                execution.process = undefined;

                this.outputChannel.appendLine(`Command error: ${error.message}`);
                resolve(execution);
            });
        });
    }

    async executeInTerminal(command: string): Promise<void> {
        const terminal = this.getOrCreateTerminal();
        terminal.show();
        terminal.sendText(command);
    }

    cancelExecution(id: string): boolean {
        const execution = this.executions.get(id);
        if (execution?.process && execution.isRunning) {
            execution.process.kill('SIGTERM');
            setTimeout(() => {
                if (execution.isRunning && execution.process) {
                    execution.process.kill('SIGKILL');
                }
            }, 5000);
            return true;
        }
        return false;
    }

    cancelAllExecutions(): void {
        for (const [id, execution] of this.executions) {
            if (execution.isRunning) {
                this.cancelExecution(id);
            }
        }
    }

    getExecution(id: string): CommandExecution | undefined {
        return this.executions.get(id);
    }

    getRecentExecutions(limit = 10): CommandExecution[] {
        return Array.from(this.executions.values())
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit);
    }

    clearHistory(): void {
        for (const [id, execution] of this.executions) {
            if (!execution.isRunning) {
                this.executions.delete(id);
            }
        }
    }

    async runWithProgress(
        command: string,
        title: string,
        cwd?: string
    ): Promise<CommandExecution> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: true
            },
            async (
                progress: vscode.Progress<{ message?: string; increment?: number }>,
                token: vscode.CancellationToken
            ) => {
                const execution = await this.executeCommand(command, cwd, (data: string) => {
                    const lines = data.split('\n').filter((l: string) => l.trim());
                    if (lines.length > 0) {
                        progress.report({ message: lines[lines.length - 1].slice(0, 50) });
                    }
                });

                token.onCancellationRequested(() => {
                    this.cancelExecution(execution.id);
                });

                return execution;
            }
        );
    }

    dispose(): void {
        this.cancelAllExecutions();
        this.terminal?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
