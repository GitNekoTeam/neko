import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export interface EnvironmentInfo {
    os: {
        platform: string;
        release: string;
        arch: string;
        homedir: string;
    };
    vscode: {
        version: string;
        appName: string;
        language: string;
        shell: string;
    };
    workspace: {
        name?: string;
        rootPath?: string;
        workspaceFolders: string[];
    };
    runtime: {
        nodeVersion: string;
        extensionPath: string;
        globalStoragePath: string;
    };
    git?: {
        version?: string;
        userName?: string;
        userEmail?: string;
    };
}

export interface ShellInfo {
    shell: string;
    shellArgs: string[];
    env: Record<string, string>;
}

export class EnvironmentManager {
    private context: vscode.ExtensionContext;
    private cachedInfo: EnvironmentInfo | null = null;
    private cachedShellInfo: ShellInfo | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async getEnvironmentInfo(): Promise<EnvironmentInfo> {
        if (this.cachedInfo) {
            return this.cachedInfo;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
        const gitInfo = await this.getGitInfo();

        this.cachedInfo = {
            os: {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                homedir: os.homedir()
            },
            vscode: {
                version: vscode.version,
                appName: vscode.env.appName,
                language: vscode.env.language,
                shell: vscode.env.shell
            },
            workspace: {
                name: vscode.workspace.name,
                rootPath: workspaceFolders[0],
                workspaceFolders
            },
            runtime: {
                nodeVersion: process.version,
                extensionPath: this.context.extensionPath,
                globalStoragePath: this.context.globalStorageUri.fsPath
            },
            git: gitInfo
        };

        return this.cachedInfo;
    }

    private async getGitInfo(): Promise<EnvironmentInfo['git']> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) return undefined;

            const git = gitExtension.exports.getAPI(1);
            if (!git || git.repositories.length === 0) return undefined;

            const repo = git.repositories[0];
            const config = repo.state.HEAD;

            return {
                version: git.version,
                userName: config?.name,
                userEmail: config?.email
            };
        } catch {
            return undefined;
        }
    }

    getShellInfo(): ShellInfo {
        if (this.cachedShellInfo) {
            return this.cachedShellInfo;
        }

        const platform = os.platform();
        let shell: string;
        let shellArgs: string[] = [];

        if (platform === 'win32') {
            shell = process.env.COMSPEC || 'cmd.exe';
            if (shell.toLowerCase().includes('powershell')) {
                shellArgs = ['-NoLogo', '-NoProfile'];
            }
        } else {
            shell = process.env.SHELL || '/bin/bash';
            shellArgs = ['-l'];
        }

        const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
        const configShell = terminalConfig.get<string>(`shell.${platform}`);
        if (configShell) {
            shell = configShell;
        }

        this.cachedShellInfo = {
            shell,
            shellArgs,
            env: this.getShellEnv()
        };

        return this.cachedShellInfo;
    }

    private getShellEnv(): Record<string, string> {
        const env: Record<string, string> = { ...process.env as Record<string, string> };
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            env['WORKSPACE_ROOT'] = workspaceRoot;
        }

        env['NEKO_AI'] = 'true';
        env['NEKO_VERSION'] = this.context.extension.packageJSON.version || '1.0.0';

        return env;
    }

    buildSystemPromptContext(): string {
        const info = this.cachedInfo || {
            os: { platform: os.platform(), arch: os.arch() },
            vscode: { version: vscode.version, shell: vscode.env.shell },
            workspace: { rootPath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath }
        };

        const lines: string[] = [
            '## Environment',
            `- OS: ${info.os.platform} (${info.os.arch})`,
            `- Shell: ${info.vscode.shell}`,
            `- VS Code: ${info.vscode.version}`
        ];

        if (info.workspace.rootPath) {
            lines.push(`- Workspace: ${path.basename(info.workspace.rootPath)}`);
        }

        return lines.join('\n');
    }

    isWindows(): boolean {
        return os.platform() === 'win32';
    }

    isMac(): boolean {
        return os.platform() === 'darwin';
    }

    isLinux(): boolean {
        return os.platform() === 'linux';
    }

    getPathSeparator(): string {
        return path.sep;
    }

    normalizePath(filePath: string): string {
        if (this.isWindows()) {
            return filePath.replace(/\//g, '\\');
        }
        return filePath.replace(/\\/g, '/');
    }

    async detectProjectType(): Promise<string[]> {
        const types: string[] = [];
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return types;

        const checks: { file: string; type: string }[] = [
            { file: 'package.json', type: 'nodejs' },
            { file: 'tsconfig.json', type: 'typescript' },
            { file: 'requirements.txt', type: 'python' },
            { file: 'pyproject.toml', type: 'python' },
            { file: 'Cargo.toml', type: 'rust' },
            { file: 'go.mod', type: 'go' },
            { file: 'pom.xml', type: 'java-maven' },
            { file: 'build.gradle', type: 'java-gradle' },
            { file: 'Gemfile', type: 'ruby' },
            { file: 'composer.json', type: 'php' },
            { file: '.csproj', type: 'dotnet' },
            { file: 'Dockerfile', type: 'docker' },
            { file: 'docker-compose.yml', type: 'docker-compose' }
        ];

        for (const check of checks) {
            try {
                const uri = vscode.Uri.file(path.join(workspaceRoot, check.file));
                await vscode.workspace.fs.stat(uri);
                types.push(check.type);
            } catch {
                // File doesn't exist
            }
        }

        return types;
    }

    clearCache(): void {
        this.cachedInfo = null;
        this.cachedShellInfo = null;
    }
}
