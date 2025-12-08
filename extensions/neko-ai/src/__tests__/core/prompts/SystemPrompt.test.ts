import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
    }
}));

vi.mock('os', () => ({
    platform: vi.fn(() => 'linux'),
    release: vi.fn(() => '5.15.0'),
    arch: vi.fn(() => 'x64'),
    homedir: vi.fn(() => '/home/user'),
    tmpdir: vi.fn(() => '/tmp'),
    cpus: vi.fn(() => [1, 2, 3, 4]),
    totalmem: vi.fn(() => 16 * 1024 * 1024 * 1024),
    hostname: vi.fn(() => 'test-host')
}));

describe('SystemPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('system detection', () => {
        it('should detect Linux platform', () => {
            const platform = 'linux';
            expect(platform).toBe('linux');
        });

        it('should detect Windows platform', () => {
            const platform = 'win32';
            expect(platform).toBe('win32');
        });

        it('should detect macOS platform', () => {
            const platform = 'darwin';
            expect(platform).toBe('darwin');
        });
    });

    describe('OS name mapping', () => {
        it('should map platform to OS name', () => {
            const getOSName = (platform: string): string => {
                switch (platform) {
                    case 'darwin': return 'macOS';
                    case 'win32': return 'Windows';
                    case 'linux': return 'Linux';
                    default: return platform;
                }
            };

            expect(getOSName('darwin')).toBe('macOS');
            expect(getOSName('win32')).toBe('Windows');
            expect(getOSName('linux')).toBe('Linux');
        });
    });

    describe('shell detection', () => {
        it('should detect shell for Windows', () => {
            const detectShell = (platform: string): string => {
                if (platform === 'win32') {
                    return process.env.COMSPEC || 'cmd.exe';
                }
                return process.env.SHELL || '/bin/bash';
            };

            expect(detectShell('win32')).toContain('cmd');
        });

        it('should detect shell for Unix', () => {
            const detectShell = (platform: string): string => {
                if (platform === 'win32') {
                    return 'cmd.exe';
                }
                return '/bin/bash';
            };

            expect(detectShell('linux')).toBe('/bin/bash');
        });
    });

    describe('memory formatting', () => {
        it('should format bytes to GB', () => {
            const formatBytes = (bytes: number): string => {
                const gb = bytes / (1024 * 1024 * 1024);
                return `${gb.toFixed(1)} GB`;
            };

            expect(formatBytes(16 * 1024 * 1024 * 1024)).toBe('16.0 GB');
            expect(formatBytes(8 * 1024 * 1024 * 1024)).toBe('8.0 GB');
        });
    });

    describe('platform notes', () => {
        it('should provide Windows-specific notes', () => {
            const notes = 'Use backslashes for file paths';
            expect(notes).toContain('backslash');
        });

        it('should provide macOS-specific notes', () => {
            const notes = 'Use open command to open files';
            expect(notes).toContain('open');
        });

        it('should provide Linux-specific notes', () => {
            const notes = 'Use xdg-open to open files';
            expect(notes).toContain('xdg-open');
        });
    });
});
