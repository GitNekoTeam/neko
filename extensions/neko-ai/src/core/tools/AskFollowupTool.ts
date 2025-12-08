import * as vscode from 'vscode';
import { BaseTool, ToolResult, ToolInput, ToolDefinition } from './BaseTool';

export interface FollowupResponse {
    answer: string;
    selectedOption?: string;
}

export type FollowupHandler = (question: string, options?: string[]) => Promise<FollowupResponse | undefined>;

export class AskFollowupTool extends BaseTool {
    public readonly name = 'ask_followup_question';
    public readonly description = 'Ask the user a follow-up question to gather more information or clarification.';

    private followupHandler?: FollowupHandler;

    public getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The question to ask the user'
                    },
                    options: {
                        type: 'array',
                        description: 'Optional list of predefined answer options'
                    },
                    allowFreeform: {
                        type: 'boolean',
                        description: 'Allow free-form text input in addition to options'
                    }
                },
                required: ['question']
            }
        };
    }

    public setFollowupHandler(handler: FollowupHandler): void {
        this.followupHandler = handler;
    }

    public async execute(input: ToolInput): Promise<ToolResult> {
        const question = input.question as string;
        const options = input.options as string[] | undefined;
        const allowFreeform = (input.allowFreeform as boolean) ?? true;

        try {
            let response: FollowupResponse | undefined;

            if (this.followupHandler) {
                response = await this.followupHandler(question, options);
            } else {
                response = await this.showQuickPick(question, options, allowFreeform);
            }

            if (!response) {
                return this.failure('User cancelled the question');
            }

            return this.success(response.answer, {
                userResponse: response.answer,
                selectedOption: response.selectedOption
            });
        } catch (error) {
            return this.failure(`Failed to ask question: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async showQuickPick(
        question: string, 
        options?: string[], 
        allowFreeform = true
    ): Promise<FollowupResponse | undefined> {
        if (options && options.length > 0) {
            const items: vscode.QuickPickItem[] = options.map(opt => ({
                label: opt,
                description: ''
            }));

            if (allowFreeform) {
                items.push({
                    label: '$(edit) Enter custom response...',
                    description: 'Type your own answer'
                });
            }

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: question,
                title: 'Follow-up Question'
            });

            if (!selected) {
                return undefined;
            }

            if (selected.label.includes('Enter custom response')) {
                const customAnswer = await vscode.window.showInputBox({
                    prompt: question,
                    title: 'Follow-up Question'
                });
                return customAnswer ? { answer: customAnswer } : undefined;
            }

            return {
                answer: selected.label,
                selectedOption: selected.label
            };
        }

        const answer = await vscode.window.showInputBox({
            prompt: question,
            title: 'Follow-up Question',
            placeHolder: 'Enter your response...'
        });

        return answer ? { answer } : undefined;
    }
}
