import { AssistantMessageParser, parseAssistantMessage, extractToolCalls } from '../../../core/parser';

describe('AssistantMessageParser', () => {
    let parser: AssistantMessageParser;

    beforeEach(() => {
        parser = new AssistantMessageParser();
    });

    describe('parse', () => {
        it('should parse plain text', () => {
            const result = parser.parse('Hello, this is a simple message.');
            
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].type).toBe('text');
            expect(result.toolCalls).toHaveLength(0);
        });

        it('should parse tool calls with JSON params', () => {
            const content = `Let me read the file.
<tool name="read_file">
{"path": "src/index.ts"}
</tool>`;

            const result = parser.parse(content);
            
            expect(result.toolCalls).toHaveLength(1);
            expect(result.toolCalls[0].name).toBe('read_file');
            expect(result.toolCalls[0].params).toEqual({ path: 'src/index.ts' });
        });

        it('should parse multiple tool calls', () => {
            const content = `<tool name="read_file">
{"path": "file1.ts"}
</tool>
Some text in between.
<tool name="write_to_file">
{"path": "file2.ts", "content": "hello"}
</tool>`;

            const result = parser.parse(content);
            
            expect(result.toolCalls).toHaveLength(2);
            expect(result.toolCalls[0].name).toBe('read_file');
            expect(result.toolCalls[1].name).toBe('write_to_file');
        });

        it('should parse thinking blocks', () => {
            const content = `<thinking>
Let me think about this problem...
</thinking>
Here is my answer.`;

            const result = parser.parse(content);
            
            const thinkingBlock = result.blocks.find(b => b.type === 'thinking');
            expect(thinkingBlock).toBeDefined();
            expect(thinkingBlock?.type).toBe('thinking');
        });

        it('should parse code blocks', () => {
            const content = `Here is some code:
\`\`\`typescript
const x = 1;
\`\`\``;

            const result = parser.parse(content);
            
            const codeBlock = result.blocks.find(b => b.type === 'code');
            expect(codeBlock).toBeDefined();
            if (codeBlock?.type === 'code') {
                expect(codeBlock.language).toBe('typescript');
                expect(codeBlock.content).toContain('const x = 1');
            }
        });

        it('should detect partial tool calls', () => {
            const content = `Starting to use a tool...
<tool name="read_file">
{"path": "test.ts"`;

            const result = parser.parse(content);
            
            expect(result.hasPartialTool).toBe(true);
        });

        it('should parse XML-style params', () => {
            const content = `<tool name="execute_command">
<command>npm test</command>
<requiresApproval>true</requiresApproval>
</tool>`;

            const result = parser.parse(content);
            
            expect(result.toolCalls).toHaveLength(1);
            expect(result.toolCalls[0].params.command).toBe('npm test');
            expect(result.toolCalls[0].params.requiresApproval).toBe(true);
        });
    });

    describe('extractToolCalls', () => {
        it('should extract tool calls from content', () => {
            const content = '<tool name="test_tool">{"arg": "value"}</tool>';
            const tools = parser.extractToolCalls(content);
            
            expect(tools).toHaveLength(1);
            expect(tools[0].name).toBe('test_tool');
        });
    });

    describe('extractText', () => {
        it('should extract only text content', () => {
            const content = `Hello
<tool name="test">{"a": 1}</tool>
World`;

            const text = parser.extractText(content);
            
            expect(text).toContain('Hello');
            expect(text).toContain('World');
            expect(text).not.toContain('tool');
        });
    });

    describe('hasToolCalls', () => {
        it('should return true when tool calls exist', () => {
            const content = '<tool name="test">{"a": 1}</tool>';
            expect(parser.hasToolCalls(content)).toBe(true);
        });

        it('should return false when no tool calls', () => {
            const content = 'Just plain text';
            expect(parser.hasToolCalls(content)).toBe(false);
        });
    });
});

describe('parseAssistantMessage', () => {
    it('should parse message with default options', () => {
        const result = parseAssistantMessage('<tool name="test">{}</tool>');
        expect(result.toolCalls).toHaveLength(1);
    });
});

describe('extractToolCalls', () => {
    it('should extract tool calls using helper function', () => {
        const tools = extractToolCalls('<tool name="test">{}</tool>');
        expect(tools).toHaveLength(1);
    });
});
