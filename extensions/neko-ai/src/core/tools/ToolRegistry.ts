import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { ReadFileTool } from './ReadFileTool';
import { WriteFileTool } from './WriteFileTool';
import { SearchTool, GrepTool } from './SearchTool';
import { ExecuteCommandTool } from './ExecuteCommandTool';
import { createBrowserTools } from './BrowserTool';
import { ApplyDiffTool } from './ApplyDiffTool';
import { InsertContentTool } from './InsertContentTool';
import { NewFileTool } from './NewFileTool';
import { AskFollowupTool } from './AskFollowupTool';
import { AttemptCompletionTool } from './AttemptCompletionTool';
import { CodeIndexManager } from '../../services/code-index/CodeIndexManager';
import { TerminalService } from '../../services/terminal/TerminalService';
import { BrowserService } from '../../services/browser/BrowserService';

export class ToolRegistry {
    private tools: Map<string, BaseTool> = new Map();
    private outputChannel: vscode.OutputChannel;

    constructor(
        outputChannel: vscode.OutputChannel,
        codeIndexManager: CodeIndexManager,
        terminalService: TerminalService,
        browserService: BrowserService
    ) {
        this.outputChannel = outputChannel;
        this.registerDefaultTools(codeIndexManager, terminalService, browserService);
    }

    private registerDefaultTools(
        codeIndexManager: CodeIndexManager,
        terminalService: TerminalService,
        browserService: BrowserService
    ): void {
        this.register(new ReadFileTool(this.outputChannel));
        this.register(new WriteFileTool(this.outputChannel));
        this.register(new ApplyDiffTool(this.outputChannel));
        this.register(new InsertContentTool(this.outputChannel));
        this.register(new NewFileTool(this.outputChannel));
        this.register(new AskFollowupTool(this.outputChannel));
        this.register(new AttemptCompletionTool(this.outputChannel));
        this.register(new SearchTool(this.outputChannel, codeIndexManager));
        this.register(new GrepTool(this.outputChannel));
        this.register(new ExecuteCommandTool(this.outputChannel, terminalService));
        const browserTools = createBrowserTools(this.outputChannel, browserService);
        for (const tool of browserTools) {
            this.register(tool);
        }
    }

    register(tool: BaseTool): void {
        this.tools.set(tool.name, tool);
        this.outputChannel.appendLine(`Registered tool: ${tool.name}`);
    }

    unregister(name: string): boolean {
        return this.tools.delete(name);
    }

    get(name: string): BaseTool | undefined {
        return this.tools.get(name);
    }

    getAll(): BaseTool[] {
        return Array.from(this.tools.values());
    }

    getDefinitions(): ToolDefinition[] {
        return this.getAll().map(tool => tool.getDefinition());
    }

    async execute(name: string, input: ToolInput): Promise<ToolResult> {
        const tool = this.tools.get(name);
        
        if (!tool) {
            return {
                success: false,
                output: '',
                error: `Unknown tool: ${name}`
            };
        }

        this.outputChannel.appendLine(`Executing tool: ${name}`);
        this.outputChannel.appendLine(`Input: ${JSON.stringify(input)}`);

        try {
            const result = await tool.execute(input);
            this.outputChannel.appendLine(`Result: ${result.success ? 'success' : 'failure'}`);
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`Error: ${message}`);
            return {
                success: false,
                output: '',
                error: message
            };
        }
    }

    getToolsPrompt(): string {
        const definitions = this.getDefinitions();
        let prompt = 'Available tools:\n\n';

        for (const def of definitions) {
            prompt += `## ${def.name}\n`;
            prompt += `${def.description}\n\n`;
            prompt += 'Parameters:\n';
            
            for (const [key, prop] of Object.entries(def.inputSchema.properties)) {
                const required = def.inputSchema.required?.includes(key) ? ' (required)' : '';
                prompt += `- ${key}: ${prop.description}${required}\n`;
            }
            prompt += '\n';
        }

        prompt += '\nTo use a tool, respond with:\n';
        prompt += '<tool name="tool_name">\n';
        prompt += '{"param1": "value1", "param2": "value2"}\n';
        prompt += '</tool>\n';

        return prompt;
    }
}
