import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { TerminalService } from '../../services/terminal/TerminalService';

export class ExecuteCommandTool extends BaseTool {
    name = 'execute_command';
    description = 'Execute a shell command in the workspace';

    private terminalService: TerminalService;

    constructor(outputChannel: vscode.OutputChannel, terminalService: TerminalService) {
        super(outputChannel);
        this.terminalService = terminalService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The shell command to execute'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory for the command (relative to workspace)'
                    },
                    background: {
                        type: 'boolean',
                        description: 'Run command in background terminal without capturing output'
                    }
                },
                required: ['command']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const command = input.command as string;
        const cwd = input.cwd as string | undefined;
        const background = input.background as boolean ?? false;

        if (!command) {
            return this.failure('Command is required');
        }

        const dangerousPatterns = [
            /rm\s+-rf\s+[/~]/i,
            /rm\s+-rf\s+\*/i,
            /mkfs/i,
            /dd\s+if=/i,
            />\s*\/dev\/sd/i,
            /chmod\s+-R\s+777\s+\//i,
            /curl.*\|\s*(ba)?sh/i,
            /wget.*\|\s*(ba)?sh/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                return this.failure('Command blocked: potentially dangerous operation detected');
            }
        }

        try {
            if (background) {
                await this.terminalService.executeInTerminal(command);
                return this.success(`Command started in terminal: ${command}`);
            }

            const result = await this.terminalService.executeCommand(command, cwd);

            let output = `Command: ${command}\n`;
            output += `Exit code: ${result.exitCode}\n`;
            output += `Duration: ${((result.endTime || Date.now()) - result.startTime) / 1000}s\n\n`;
            output += `Output:\n${result.output}`;

            if (result.exitCode === 0) {
                return this.success(output, {
                    exitCode: result.exitCode,
                    output: result.output
                });
            } else {
                return {
                    success: false,
                    output,
                    error: `Command exited with code ${result.exitCode}`,
                    data: { exitCode: result.exitCode, output: result.output }
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return this.failure(`Command execution failed: ${message}`);
        }
    }
}
