import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { getShell } from '../../utils/shell';

export interface TerminalOptions {
    name?: string;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
}

export interface CommandResult {
    exitCode: number | undefined;
    output: string;
    error?: string;
    timedOut: boolean;
}

export interface TerminalProcess {
    id: number;
    command: string;
    status: 'running' | 'completed' | 'error' | 'timeout';
    output: string;
    exitCode?: number;
    startTime: number;
    endTime?: number;
}

export interface TerminalCallbacks {
    onLine?: (line: string) => void;
    onComplete?: (result: CommandResult) => void;
    onError?: (error: Error) => void;
}

export class TerminalIntegration extends EventEmitter {
    private terminals: Map<number, vscode.Terminal> = new Map();
    private processes: Map<number, TerminalProcess> = new Map();
    private outputBuffers: Map<number, string> = new Map();
    private nextId: number = 1;
    private defaultTimeout: number;

    constructor(defaultTimeout: number = 30000) {
        super();
        this.defaultTimeout = defaultTimeout;

        vscode.window.onDidCloseTerminal(terminal => {
            for (const [id, t] of this.terminals) {
                if (t === terminal) {
                    this.terminals.delete(id);
                    this.emit('terminalClosed', id);
                    break;
                }
            }
        });
    }

    createTerminal(options: TerminalOptions = {}): number {
        const id = this.nextId++;
        const shell = getShell();

        const terminal = vscode.window.createTerminal({
            name: options.name || `Neko Terminal ${id}`,
            cwd: options.cwd,
            env: options.env,
            shellPath: shell
        });

        this.terminals.set(id, terminal);
        this.outputBuffers.set(id, '');

        return id;
    }

    async runCommand(
        command: string,
        options: TerminalOptions & { callbacks?: TerminalCallbacks } = {}
    ): Promise<CommandResult> {
        const terminalId = this.createTerminal(options);
        const terminal = this.terminals.get(terminalId);

        if (!terminal) {
            throw new Error('Failed to create terminal');
        }

        const timeout = options.timeout || this.defaultTimeout;
        const process: TerminalProcess = {
            id: terminalId,
            command,
            status: 'running',
            output: '',
            startTime: Date.now()
        };

        this.processes.set(terminalId, process);

        return new Promise((resolve) => {
            let timedOut = false;
            let output = '';

            const timeoutId = setTimeout(() => {
                timedOut = true;
                process.status = 'timeout';
                process.endTime = Date.now();

                this.killTerminal(terminalId);

                resolve({
                    exitCode: undefined,
                    output,
                    timedOut: true,
                    error: `Command timed out after ${timeout}ms`
                });
            }, timeout);

            terminal.show(false);
            terminal.sendText(command);

            const checkInterval = setInterval(() => {
                const currentOutput = this.outputBuffers.get(terminalId) || '';
                if (currentOutput !== output) {
                    output = currentOutput;
                    process.output = output;

                    if (options.callbacks?.onLine) {
                        const lines = output.split('\n');
                        const lastLine = lines[lines.length - 1];
                        options.callbacks.onLine(lastLine);
                    }
                }
            }, 100);

            setTimeout(() => {
                clearTimeout(timeoutId);
                clearInterval(checkInterval);

                if (!timedOut) {
                    process.status = 'completed';
                    process.endTime = Date.now();

                    const result: CommandResult = {
                        exitCode: 0,
                        output: this.outputBuffers.get(terminalId) || '',
                        timedOut: false
                    };

                    if (options.callbacks?.onComplete) {
                        options.callbacks.onComplete(result);
                    }

                    resolve(result);
                }
            }, Math.min(timeout, 5000));
        });
    }

    async runCommandWithApproval(
        command: string,
        options: TerminalOptions = {}
    ): Promise<CommandResult | null> {
        const approval = await vscode.window.showWarningMessage(
            `Execute command: ${command}`,
            { modal: true },
            'Execute',
            'Cancel'
        );

        if (approval !== 'Execute') {
            return null;
        }

        return this.runCommand(command, options);
    }

    getTerminal(id: number): vscode.Terminal | undefined {
        return this.terminals.get(id);
    }

    getProcess(id: number): TerminalProcess | undefined {
        return this.processes.get(id);
    }

    getAllProcesses(): TerminalProcess[] {
        return Array.from(this.processes.values());
    }

    getRunningProcesses(): TerminalProcess[] {
        return this.getAllProcesses().filter(p => p.status === 'running');
    }

    killTerminal(id: number): boolean {
        const terminal = this.terminals.get(id);
        if (!terminal) {
            return false;
        }

        terminal.dispose();
        this.terminals.delete(id);

        const process = this.processes.get(id);
        if (process && process.status === 'running') {
            process.status = 'error';
            process.endTime = Date.now();
        }

        return true;
    }

    killAllTerminals(): void {
        for (const id of this.terminals.keys()) {
            this.killTerminal(id);
        }
    }

    showTerminal(id: number): void {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.show();
        }
    }

    hideTerminal(id: number): void {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.hide();
        }
    }

    sendText(id: number, text: string): void {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.sendText(text);
        }
    }

    dispose(): void {
        this.killAllTerminals();
        this.removeAllListeners();
    }
}
