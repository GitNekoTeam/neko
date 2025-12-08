import * as vscode from 'vscode';

export interface ToolInput {
    [key: string]: unknown;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    data?: unknown;
}

export interface SchemaProperty {
    type: string;
    description?: string;
    required?: boolean | string[];
    enum?: string[];
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
}

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, SchemaProperty>;
        required?: string[];
    };
}

export abstract class BaseTool {
    abstract name: string;
    abstract description: string;
    
    protected outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    abstract getDefinition(): ToolDefinition;
    abstract execute(input: ToolInput): Promise<ToolResult>;

    protected log(message: string): void {
        this.outputChannel.appendLine(`[${this.name}] ${message}`);
    }

    protected success(output: string, data?: unknown): ToolResult {
        return { success: true, output, data };
    }

    protected failure(error: string): ToolResult {
        return { success: false, output: '', error };
    }
}
