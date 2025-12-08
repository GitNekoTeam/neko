import * as vscode from 'vscode';
import * as os from 'os';

export interface SystemInfo {
    platform: NodeJS.Platform;
    osName: string;
    osVersion: string;
    arch: string;
    shell: string;
    homeDir: string;
    tempDir: string;
    cpuCores: number;
    totalMemory: string;
    nodeVersion: string;
    hostname: string;
}

export interface PromptContext {
    workspacePath?: string;
    currentFile?: string;
    selectedCode?: string;
    language?: string;
    diagnostics?: string[];
    gitBranch?: string;
    customInstructions?: string;
    systemInfo?: SystemInfo;
    hasVisionSupport?: boolean;
    imageContext?: ImageContext[];
}

export interface ImageContext {
    type: 'screenshot' | 'upload' | 'clipboard';
    description?: string;
    base64?: string;
    mimeType?: string;
}

export class SystemPromptBuilder {
    private context: PromptContext;
    private systemInfo: SystemInfo;

    constructor(context: PromptContext = {}) {
        this.context = context;
        this.systemInfo = context.systemInfo || this.detectSystemInfo();
    }

    private detectSystemInfo(): SystemInfo {
        const platform = os.platform();
        const release = os.release();
        
        return {
            platform,
            osName: this.getOSName(platform),
            osVersion: release,
            arch: os.arch(),
            shell: this.detectShell(platform),
            homeDir: os.homedir(),
            tempDir: os.tmpdir(),
            cpuCores: os.cpus().length,
            totalMemory: this.formatBytes(os.totalmem()),
            nodeVersion: process.version,
            hostname: os.hostname()
        };
    }

    private detectShell(platform: NodeJS.Platform): string {
        if (platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    private formatBytes(bytes: number): string {
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(1)} GB`;
    }

    build(): string {
        const sections: string[] = [];

        sections.push(this.buildIdentity());
        sections.push(this.buildSystemContext());
        sections.push(this.buildCapabilities());
        sections.push(this.buildEnvironment());
        sections.push(this.buildGuidelines());
        sections.push(this.buildCommandGuidelines());
        
        if (this.context.hasVisionSupport) {
            sections.push(this.buildVisionCapabilities());
        }

        if (this.context.customInstructions) {
            sections.push(this.buildCustomInstructions());
        }

        return sections.join('\n\n');
    }

    private buildSystemContext(): string {
        const sys = this.systemInfo;
        
        return `# Current System Context

IMPORTANT: You are operating on the following system. All commands, file paths, and scripts MUST be compatible with this environment.

- Operating System: ${sys.osName} (${sys.osVersion})
- Architecture: ${sys.arch}
- Shell: ${sys.shell}
- Home Directory: ${sys.homeDir}
- CPU Cores: ${sys.cpuCores}
- Total Memory: ${sys.totalMemory}

Platform-specific notes:
${this.getPlatformNotes()}`;
    }

    private getPlatformNotes(): string {
        const platform = this.systemInfo.platform;
        
        if (platform === 'win32') {
            return `- Use backslashes (\\) for file paths or forward slashes with proper escaping
- Use Windows-compatible commands (dir instead of ls, copy instead of cp, etc.)
- PowerShell commands are preferred over cmd.exe
- Environment variables use %VAR% syntax in cmd or $env:VAR in PowerShell
- Line endings are CRLF (\\r\\n)
- File paths are case-insensitive
- Use "start" to open files/URLs, not "open" or "xdg-open"`;
        }
        
        if (platform === 'darwin') {
            return `- Use forward slashes (/) for file paths
- macOS uses BSD-style commands (some differ from GNU/Linux)
- Use "open" command to open files/URLs
- Homebrew is the common package manager (brew)
- Line endings are LF (\\n)
- File system is case-insensitive by default (APFS)
- Use pbcopy/pbpaste for clipboard operations`;
        }
        
        return `- Use forward slashes (/) for file paths
- GNU/Linux commands and utilities
- Use "xdg-open" to open files/URLs
- Package managers vary by distro (apt, yum, pacman, etc.)
- Line endings are LF (\\n)
- File system is case-sensitive
- Use xclip or xsel for clipboard operations`;
    }

    private buildIdentity(): string {
        return `# Identity

You are Neko AI, an intelligent coding assistant integrated into a code editor. You are designed to help developers write, understand, debug, and improve code efficiently.

Your personality:
- Helpful and knowledgeable
- Concise but thorough when needed
- Patient and supportive
- Focused on practical solutions
- Adaptive and context-aware
- Proactive in suggesting improvements`;
    }

    private buildCapabilities(): string {
        return `# Capabilities

You can:
1. **Code Understanding**: Analyze and explain code in any programming language
2. **Code Generation**: Write new code based on requirements
3. **Code Modification**: Edit existing code to fix bugs, add features, or improve quality
4. **Debugging**: Help identify and fix issues in code
5. **Terminal Commands**: Execute shell commands with timeout protection
6. **File Operations**: Read, write, and search files in the workspace
7. **Browser Debugging**: Take screenshots, read console logs, and inspect network requests
8. **Codebase Search**: Search across the entire codebase using semantic search

Available tools:
- read_file: Read contents of a file
- write_file: Write or modify a file
- search_files: Search for files by name or content
- execute_command: Run terminal commands
- browser_screenshot: Capture browser screenshots
- browser_console: Read browser console logs
- browser_navigate: Navigate browser to URL
- search_codebase: Semantic search across codebase`;
    }

    private buildEnvironment(): string {
        const platform = os.platform();
        const shell = process.env.SHELL || (platform === 'win32' ? 'cmd.exe' : '/bin/bash');
        
        let env = `# Environment

- Operating System: ${this.getOSName(platform)}
- Shell: ${shell}`;

        if (this.context.workspacePath) {
            env += `\n- Workspace: ${this.context.workspacePath}`;
        }

        if (this.context.currentFile) {
            env += `\n- Current File: ${this.context.currentFile}`;
        }

        if (this.context.language) {
            env += `\n- Language: ${this.context.language}`;
        }

        if (this.context.gitBranch) {
            env += `\n- Git Branch: ${this.context.gitBranch}`;
        }

        return env;
    }

    private buildGuidelines(): string {
        return `# Guidelines

1. **Be Concise**: Provide clear, focused responses without unnecessary verbosity
2. **Show Code**: When suggesting code changes, show the complete modified code
3. **Explain Changes**: Briefly explain what changes you made and why
4. **Use Markdown**: Format responses with proper markdown for readability
5. **Handle Errors**: If something fails, explain what went wrong and suggest alternatives
6. **Respect Context**: Consider the existing codebase style and conventions
7. **Security First**: Never suggest code that could be harmful or insecure
8. **Ask for Clarification**: If the request is ambiguous, ask for more details

When executing commands:
- Always explain what a command does before running it
- Use appropriate timeouts for long-running commands
- Handle errors gracefully and provide helpful feedback

When modifying files:
- Show a diff or clear indication of changes
- Preserve existing formatting and style
- Make minimal changes to achieve the goal`;
    }

    private buildCustomInstructions(): string {
        return `# Custom Instructions

${this.context.customInstructions}`;
    }

    private buildCommandGuidelines(): string {
        const sys = this.systemInfo;
        
        if (sys.platform === 'win32') {
            return `# Command Guidelines (Windows)

When executing commands on this Windows system:
- Use PowerShell syntax when possible
- Path separator: backslash (\\) or forward slash (/)
- Common commands: dir, copy, move, del, type, mkdir, rmdir
- Use "where" instead of "which" to find executables
- Use "set" or "$env:" for environment variables
- Use "start" to open files or URLs`;
        }
        
        if (sys.platform === 'darwin') {
            return `# Command Guidelines (macOS)

When executing commands on this macOS system:
- Use bash/zsh syntax
- Path separator: forward slash (/)
- BSD-style commands (may differ from GNU/Linux)
- Use "open" to open files or URLs
- Use "brew" for package management
- Use "pbcopy/pbpaste" for clipboard`;
        }
        
        return `# Command Guidelines (Linux)

When executing commands on this Linux system:
- Use bash syntax
- Path separator: forward slash (/)
- GNU coreutils commands
- Use "xdg-open" to open files or URLs
- Package manager depends on distro
- Use "xclip" or "xsel" for clipboard`;
    }

    private buildVisionCapabilities(): string {
        return `# Vision Capabilities

You have vision/image understanding capabilities. You can:
- Analyze screenshots of browser pages, UI, or code
- Understand diagrams, flowcharts, and architecture images
- Compare visual layouts with expected designs
- Identify UI issues, layout problems, or visual bugs
- Read text from images when needed

When analyzing images:
- Describe what you see clearly
- Point out any issues or discrepancies
- Suggest specific fixes with code when applicable
- Reference specific areas of the image when discussing`;
    }

    private getOSName(platform: string): string {
        switch (platform) {
            case 'darwin': return 'macOS';
            case 'win32': return 'Windows';
            case 'linux': return 'Linux';
            default: return platform;
        }
    }

    setContext(context: Partial<PromptContext>): void {
        this.context = { ...this.context, ...context };
    }

    static createDefault(): SystemPromptBuilder {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return new SystemPromptBuilder({
            workspacePath: workspaceFolder?.uri.fsPath
        });
    }
}

export const TASK_PROMPTS = {
    explainCode: `Explain the following code in detail. Cover:
1. What the code does
2. How it works step by step
3. Any important patterns or techniques used
4. Potential issues or improvements`,

    fixCode: `Fix the issues in the following code. Consider:
1. Syntax errors
2. Logic errors
3. Best practices violations
4. Performance issues
Provide the corrected code with explanations.`,

    improveCode: `Improve the following code. Focus on:
1. Code readability
2. Performance optimization
3. Error handling
4. Best practices
5. Documentation
Provide the improved code with explanations.`,

    generateTests: `Generate comprehensive unit tests for the following code. Include:
1. Happy path tests
2. Edge cases
3. Error cases
4. Mock setup if needed
Use appropriate testing framework for the language.`,

    generateDocs: `Generate documentation for the following code. Include:
1. Function/class descriptions
2. Parameter documentation
3. Return value documentation
4. Usage examples
5. Any important notes or warnings`,

    refactor: `Refactor the following code to improve its structure. Consider:
1. Single responsibility principle
2. DRY (Don't Repeat Yourself)
3. Meaningful naming
4. Proper abstraction
5. Maintainability`,

    generateCommitMessage: `Generate a concise and descriptive commit message for the following changes.
Follow conventional commits format: type(scope): description
Types: feat, fix, docs, style, refactor, test, chore`
};
