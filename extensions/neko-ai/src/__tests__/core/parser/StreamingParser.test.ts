import { StreamingParser, StreamChunk } from '../../../core/parser';

describe('StreamingParser', () => {
    let chunks: StreamChunk[];
    let parser: StreamingParser;

    beforeEach(() => {
        chunks = [];
        parser = new StreamingParser((chunk) => {
            chunks.push(chunk);
        });
    });

    describe('feed', () => {
        it('should emit text chunks', () => {
            parser.feed('Hello world');
            
            expect(chunks.some(c => c.type === 'text')).toBe(true);
        });

        it('should emit tool_start when tool begins', () => {
            parser.feed('<tool name="read_file">');
            
            const startChunk = chunks.find(c => c.type === 'tool_start');
            expect(startChunk).toBeDefined();
            expect(startChunk?.toolName).toBe('read_file');
        });

        it('should emit tool_end when tool completes', () => {
            parser.feed('<tool name="test">{"path": "file.ts"}</tool>');
            
            const endChunk = chunks.find(c => c.type === 'tool_end');
            expect(endChunk).toBeDefined();
            expect(endChunk?.toolParams).toEqual({ path: 'file.ts' });
        });

        it('should handle streaming tool content', () => {
            parser.feed('<tool name="test">');
            parser.feed('{"path":');
            parser.feed(' "file.ts"}');
            parser.feed('</tool>');
            
            const endChunk = chunks.find(c => c.type === 'tool_end');
            expect(endChunk).toBeDefined();
            expect(endChunk?.toolParams).toEqual({ path: 'file.ts' });
        });

        it('should emit thinking chunks', () => {
            parser.feed('<thinking>Let me think...</thinking>');
            
            const thinkingChunk = chunks.find(c => c.type === 'thinking');
            expect(thinkingChunk).toBeDefined();
            expect(thinkingChunk?.content).toBe('Let me think...');
        });

        it('should emit code chunks', () => {
            parser.feed('```typescript\nconst x = 1;\n```');
            
            const codeChunk = chunks.find(c => c.type === 'code');
            expect(codeChunk).toBeDefined();
        });

        it('should handle mixed content', () => {
            parser.feed('Hello ');
            parser.feed('<tool name="test">');
            parser.feed('{"a": 1}');
            parser.feed('</tool>');
            parser.feed(' World');
            
            expect(chunks.some(c => c.type === 'text')).toBe(true);
            expect(chunks.some(c => c.type === 'tool_start')).toBe(true);
            expect(chunks.some(c => c.type === 'tool_end')).toBe(true);
        });
    });

    describe('getFullContent', () => {
        it('should return accumulated content', () => {
            parser.feed('Hello ');
            parser.feed('World');
            
            expect(parser.getFullContent()).toBe('Hello World');
        });
    });

    describe('getToolCalls', () => {
        it('should return parsed tool calls', () => {
            parser.feed('<tool name="test">{"arg": "value"}</tool>');
            
            const tools = parser.getToolCalls();
            expect(tools).toHaveLength(1);
            expect(tools[0].name).toBe('test');
        });
    });

    describe('reset', () => {
        it('should clear buffer and state', () => {
            parser.feed('Some content');
            parser.reset();
            
            expect(parser.getFullContent()).toBe('');
        });
    });
});
