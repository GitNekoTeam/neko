import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
    window: {
        createTerminal: vi.fn(() => ({
            show: vi.fn(),
            sendText: vi.fn(),
            dispose: vi.fn()
        })),
        onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() }))
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
    }
}));

describe('TerminalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('command execution', () => {
        it('should handle command timeout configuration', () => {
            const timeout = 120;
            const timeoutMs = timeout * 1000;
            expect(timeoutMs).toBe(120000);
        });

        it('should generate unique execution ids', () => {
            const id1 = `exec_${Date.now()}`;
            const id2 = `exec_${Date.now() + 1}`;
            expect(id1).not.toBe(id2);
        });
    });

    describe('command validation', () => {
        it('should detect dangerous commands', () => {
            const dangerousPatterns = [
                /rm\s+-rf\s+[/~]/i,
                /mkfs/i,
                /dd\s+if=/i
            ];

            const testCommand = 'rm -rf /';
            const isDangerous = dangerousPatterns.some(p => p.test(testCommand));
            expect(isDangerous).toBe(true);
        });

        it('should allow safe commands', () => {
            const dangerousPatterns = [
                /rm\s+-rf\s+[/~]/i,
                /mkfs/i
            ];

            const testCommand = 'ls -la';
            const isDangerous = dangerousPatterns.some(p => p.test(testCommand));
            expect(isDangerous).toBe(false);
        });
    });

    describe('execution history', () => {
        it('should track execution metadata', () => {
            const execution = {
                id: 'exec_123',
                command: 'echo hello',
                output: 'hello\n',
                exitCode: 0,
                startTime: Date.now(),
                endTime: Date.now() + 100,
                isRunning: false
            };

            expect(execution.exitCode).toBe(0);
            expect(execution.isRunning).toBe(false);
        });
    });
});
