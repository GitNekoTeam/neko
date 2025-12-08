import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from '../../../core/tools/BaseTool';

class TestTool extends BaseTool {
    name = 'test_tool';
    description = 'A test tool';

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    input: {
                        type: 'string',
                        description: 'Test input'
                    }
                },
                required: ['input']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        if (input.input === 'error') {
            return this.failure('Test error');
        }
        return this.success(`Processed: ${input.input}`);
    }
}

vi.mock('vscode', () => ({
    OutputChannel: vi.fn()
}));

describe('BaseTool', () => {
    const mockOutputChannel = {
        appendLine: vi.fn()
    } as unknown as vscode.OutputChannel;

    it('should create tool with correct name and description', () => {
        const tool = new TestTool(mockOutputChannel);
        expect(tool.name).toBe('test_tool');
        expect(tool.description).toBe('A test tool');
    });

    it('should return correct definition', () => {
        const tool = new TestTool(mockOutputChannel);
        const def = tool.getDefinition();
        
        expect(def.name).toBe('test_tool');
        expect(def.inputSchema.properties).toHaveProperty('input');
        expect(def.inputSchema.required).toContain('input');
    });

    it('should execute successfully', async () => {
        const tool = new TestTool(mockOutputChannel);
        const result = await tool.execute({ input: 'test' });
        
        expect(result.success).toBe(true);
        expect(result.output).toBe('Processed: test');
    });

    it('should handle errors', async () => {
        const tool = new TestTool(mockOutputChannel);
        const result = await tool.execute({ input: 'error' });
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Test error');
    });
});
