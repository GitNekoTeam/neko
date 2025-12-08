import * as vscode from 'vscode';
import { BaseTool, ToolResult, ToolInput, ToolDefinition } from './BaseTool';

export type CompletionHandler = (result: string, command?: string) => Promise<void>;

export class AttemptCompletionTool extends BaseTool {
    public readonly name = 'attempt_completion';
    public readonly description = 'Indicate that the task is complete and provide a summary of what was accomplished.';

    private completionHandler?: CompletionHandler;

    public getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    result: {
                        type: 'string',
                        description: 'A summary of what was accomplished'
                    },
                    command: {
                        type: 'string',
                        description: 'Optional command for the user to run to verify the result'
                    }
                },
                required: ['result']
            }
        };
    }

    public setCompletionHandler(handler: CompletionHandler): void {
        this.completionHandler = handler;
    }

    public async execute(input: ToolInput): Promise<ToolResult> {
        const result = input.result as string;
        const command = input.command as string | undefined;

        try {
            if (this.completionHandler) {
                await this.completionHandler(result, command);
            }

            let message = `Task completed:\n${result}`;

            if (command) {
                const runCommand = await vscode.window.showInformationMessage(
                    'Task completed. Run verification command?',
                    { modal: false, detail: command },
                    'Run Command',
                    'Copy Command',
                    'Dismiss'
                );

                if (runCommand === 'Run Command') {
                    const terminal = vscode.window.createTerminal('Neko Verification');
                    terminal.show();
                    terminal.sendText(command);
                    message += `\n\nRunning: ${command}`;
                } else if (runCommand === 'Copy Command') {
                    await vscode.env.clipboard.writeText(command);
                    message += '\n\nCommand copied to clipboard';
                }
            }

            return this.success(message, {
                completed: true,
                result,
                command
            });
        } catch (error) {
            return this.failure(`Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
