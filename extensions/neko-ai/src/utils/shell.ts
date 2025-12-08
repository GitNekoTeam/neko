import * as vscode from 'vscode';
import { userInfo } from 'os';
import * as path from 'path';

const SHELL_ALLOWLIST = new Set<string>([
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files\\PowerShell\\6\\pwsh.exe',
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\System32\\wsl.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    '/bin/sh',
    '/usr/bin/sh',
    '/bin/bash',
    '/usr/bin/bash',
    '/usr/local/bin/bash',
    '/opt/homebrew/bin/bash',
    '/bin/zsh',
    '/usr/bin/zsh',
    '/usr/local/bin/zsh',
    '/opt/homebrew/bin/zsh',
    '/bin/dash',
    '/usr/bin/dash',
    '/usr/bin/fish',
    '/usr/local/bin/fish',
    '/opt/homebrew/bin/fish'
]);

const SHELL_PATHS = {
    POWERSHELL_7: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    POWERSHELL_LEGACY: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    CMD: 'C:\\Windows\\System32\\cmd.exe',
    WSL_BASH: '/bin/bash',
    MAC_DEFAULT: '/bin/zsh',
    LINUX_DEFAULT: '/bin/bash',
    FALLBACK: '/bin/sh'
} as const;

interface TerminalProfile {
    path?: string | string[];
    source?: 'PowerShell' | 'WSL';
}

type TerminalProfiles = Record<string, TerminalProfile>;

function getTerminalConfig(platform: 'windows' | 'osx' | 'linux'): {
    defaultProfileName: string | null;
    profiles: TerminalProfiles;
} {
    try {
        const config = vscode.workspace.getConfiguration('terminal.integrated');
        const defaultProfileName = config.get<string>(`defaultProfile.${platform}`);
        const profiles = config.get<TerminalProfiles>(`profiles.${platform}`) || {};
        return { defaultProfileName: defaultProfileName || null, profiles };
    } catch {
        return { defaultProfileName: null, profiles: {} };
    }
}

function normalizeShellPath(shellPath: string | string[] | undefined): string | null {
    if (!shellPath) return null;
    if (Array.isArray(shellPath)) {
        return shellPath.length > 0 ? shellPath[0] : null;
    }
    return shellPath;
}

function getWindowsShellFromVSCode(): string | null {
    const { defaultProfileName, profiles } = getTerminalConfig('windows');
    if (!defaultProfileName) return null;

    const profile = profiles[defaultProfileName];

    if (defaultProfileName.toLowerCase().includes('powershell')) {
        const normalizedPath = normalizeShellPath(profile?.path);
        if (normalizedPath) return normalizedPath;
        if (profile?.source === 'PowerShell') return SHELL_PATHS.POWERSHELL_7;
        return SHELL_PATHS.POWERSHELL_LEGACY;
    }

    const normalizedPath = normalizeShellPath(profile?.path);
    if (normalizedPath) return normalizedPath;

    if (profile?.source === 'WSL' || defaultProfileName.toLowerCase().includes('wsl')) {
        return SHELL_PATHS.WSL_BASH;
    }

    return SHELL_PATHS.CMD;
}

function getMacShellFromVSCode(): string | null {
    const { defaultProfileName, profiles } = getTerminalConfig('osx');
    if (!defaultProfileName) return null;
    return normalizeShellPath(profiles[defaultProfileName]?.path);
}

function getLinuxShellFromVSCode(): string | null {
    const { defaultProfileName, profiles } = getTerminalConfig('linux');
    if (!defaultProfileName) return null;
    return normalizeShellPath(profiles[defaultProfileName]?.path);
}

function getShellFromUserInfo(): string | null {
    try {
        const { shell } = userInfo();
        return shell || null;
    } catch {
        return null;
    }
}

function getShellFromEnv(): string | null {
    const { env } = process;

    if (process.platform === 'win32') {
        return env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
    }

    if (process.platform === 'darwin') {
        return env.SHELL || '/bin/zsh';
    }

    if (process.platform === 'linux') {
        return env.SHELL || '/bin/bash';
    }

    return null;
}

function isShellAllowed(shellPath: string): boolean {
    if (!shellPath) return false;

    const normalizedPath = path.normalize(shellPath);

    if (SHELL_ALLOWLIST.has(normalizedPath)) {
        return true;
    }

    if (process.platform === 'win32') {
        const lowerPath = normalizedPath.toLowerCase();
        for (const allowedPath of SHELL_ALLOWLIST) {
            if (allowedPath.toLowerCase() === lowerPath) {
                return true;
            }
        }
    }

    return false;
}

function getSafeFallbackShell(): string {
    if (process.platform === 'win32') {
        return SHELL_PATHS.CMD;
    } else if (process.platform === 'darwin') {
        return SHELL_PATHS.MAC_DEFAULT;
    }
    return SHELL_PATHS.LINUX_DEFAULT;
}

export function getShell(): string {
    let shell: string | null = null;

    if (process.platform === 'win32') {
        shell = getWindowsShellFromVSCode();
    } else if (process.platform === 'darwin') {
        shell = getMacShellFromVSCode();
    } else if (process.platform === 'linux') {
        shell = getLinuxShellFromVSCode();
    }

    if (!shell) {
        shell = getShellFromUserInfo();
    }

    if (!shell) {
        shell = getShellFromEnv();
    }

    if (!shell) {
        shell = getSafeFallbackShell();
    }

    if (!isShellAllowed(shell)) {
        shell = getSafeFallbackShell();
    }

    return shell;
}

export function isWindows(): boolean {
    return process.platform === 'win32';
}

export function isMac(): boolean {
    return process.platform === 'darwin';
}

export function isLinux(): boolean {
    return process.platform === 'linux';
}
