import { EventEmitter } from 'events';

export type TerminalProvider = 'vscode' | 'execa';

export interface NekoTerminal {
    provider: TerminalProvider;
    id: number;
    busy: boolean;
    running: boolean;
    taskId?: string;
    process?: NekoTerminalProcess;
    getCurrentWorkingDirectory(): string;
    isClosed(): boolean;
    runCommand(command: string, callbacks: NekoTerminalCallbacks): NekoTerminalProcessResultPromise;
    setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void;
    shellExecutionComplete(exitDetails: ExitCodeDetails): void;
    getProcessesWithOutput(): NekoTerminalProcess[];
    getUnretrievedOutput(): string;
    getLastCommand(): string;
    cleanCompletedProcessQueue(): void;
}

export interface NekoTerminalCallbacks {
    onLine: (line: string, process: NekoTerminalProcess) => void;
    onCompleted: (output: string | undefined, process: NekoTerminalProcess) => void;
    onShellExecutionStarted: (pid: number | undefined, process: NekoTerminalProcess) => void;
    onShellExecutionComplete: (details: ExitCodeDetails, process: NekoTerminalProcess) => void;
    onNoShellIntegration?: (message: string, process: NekoTerminalProcess) => void;
}

export interface NekoTerminalProcess extends EventEmitter<NekoTerminalProcessEvents> {
    command: string;
    isHot: boolean;
    run(command: string): Promise<void>;
    continue(): void;
    abort(): void;
    hasUnretrievedOutput(): boolean;
    getUnretrievedOutput(): string;
}

export type NekoTerminalProcessResultPromise = NekoTerminalProcess & Promise<void>;

export interface NekoTerminalProcessEvents {
    line: [line: string];
    continue: [];
    completed: [output?: string];
    stream_available: [stream: AsyncIterable<string>];
    shell_execution_started: [pid: number | undefined];
    shell_execution_complete: [exitDetails: ExitCodeDetails];
    error: [error: Error];
    no_shell_integration: [message: string];
}

export interface ExitCodeDetails {
    exitCode: number | undefined;
    signal?: number | undefined;
    signalName?: string;
    coreDumpPossible?: boolean;
}

export interface TerminalConfig {
    defaultTimeout: number;
    maxConcurrentTerminals: number;
    autoCloseOnComplete: boolean;
    showOutputPanel: boolean;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
    defaultTimeout: 30000,
    maxConcurrentTerminals: 5,
    autoCloseOnComplete: false,
    showOutputPanel: true
};
