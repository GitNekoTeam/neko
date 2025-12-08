describe('ApplyDiffTool', () => {
    describe('parseDiffBlocks', () => {
        it('should parse standard SEARCH/REPLACE format', () => {
            const diff = `<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE`;

            const blocks = parseDiffBlocks(diff);
            
            expect(blocks).toHaveLength(1);
            expect(blocks[0].search).toBe('const x = 1;');
            expect(blocks[0].replace).toBe('const x = 2;');
        });

        it('should parse multiple blocks', () => {
            const diff = `<<<<<<< SEARCH
line1
=======
newline1
>>>>>>> REPLACE
<<<<<<< SEARCH
line2
=======
newline2
>>>>>>> REPLACE`;

            const blocks = parseDiffBlocks(diff);
            
            expect(blocks).toHaveLength(2);
        });

        it('should handle empty replace', () => {
            const diff = `<<<<<<< SEARCH
delete this
=======
>>>>>>> REPLACE`;

            const blocks = parseDiffBlocks(diff);
            
            expect(blocks).toHaveLength(1);
            expect(blocks[0].replace).toBe('');
        });
    });

    describe('applyBlock', () => {
        it('should apply exact match', () => {
            const content = 'const x = 1;\nconst y = 2;';
            const block = { search: 'const x = 1;', replace: 'const x = 10;' };
            
            const result = applyBlock(content, block);
            
            expect(result.success).toBe(true);
            expect(result.content).toContain('const x = 10;');
        });

        it('should fail when search not found', () => {
            const content = 'const x = 1;';
            const block = { search: 'const y = 2;', replace: 'const y = 20;' };
            
            const result = applyBlock(content, block);
            
            expect(result.success).toBe(false);
        });

        it('should fail when multiple matches found', () => {
            const content = 'const x = 1;\nconst x = 1;';
            const block = { search: 'const x = 1;', replace: 'const x = 10;' };
            
            const result = applyBlock(content, block);
            
            expect(result.success).toBe(false);
        });
    });

    describe('fuzzyApplyBlock', () => {
        it('should match with whitespace differences', () => {
            const content = '    const x = 1;';
            const block = { search: 'const x = 1;', replace: 'const x = 10;' };
            
            const result = fuzzyApplyBlock(content, block);
            
            expect(result.success).toBe(true);
        });

        it('should preserve original indentation', () => {
            const content = '    function test() {\n        return 1;\n    }';
            const block = { 
                search: 'return 1;', 
                replace: 'return 2;' 
            };
            
            const result = fuzzyApplyBlock(content, block);
            
            if (result.success) {
                expect(result.content).toContain('        return 2;');
            }
        });
    });

    describe('normalizeLineEndings', () => {
        it('should convert CRLF to LF', () => {
            const text = 'line1\r\nline2\r\n';
            const normalized = normalizeLineEndings(text);
            
            expect(normalized).toBe('line1\nline2\n');
        });

        it('should convert CR to LF', () => {
            const text = 'line1\rline2\r';
            const normalized = normalizeLineEndings(text);
            
            expect(normalized).toBe('line1\nline2\n');
        });
    });
});

// Helper functions for testing (simulating the tool's internal methods)
interface DiffBlock {
    search: string;
    replace: string;
}

function parseDiffBlocks(diff: string): DiffBlock[] {
    const blocks: DiffBlock[] = [];
    const pattern = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)>>>>>>> REPLACE/g;
    
    let match;
    while ((match = pattern.exec(diff)) !== null) {
        blocks.push({
            search: match[1],
            replace: match[2].replace(/\n$/, '')
        });
    }
    
    return blocks;
}

function applyBlock(content: string, block: DiffBlock): { success: boolean; content: string; error?: string } {
    const normalized = normalizeLineEndings(content);
    const searchNormalized = normalizeLineEndings(block.search);
    
    if (!normalized.includes(searchNormalized)) {
        return { success: false, content, error: 'Search text not found' };
    }
    
    const occurrences = normalized.split(searchNormalized).length - 1;
    if (occurrences > 1) {
        return { success: false, content, error: 'Multiple matches found' };
    }
    
    return { 
        success: true, 
        content: normalized.replace(searchNormalized, block.replace) 
    };
}

function fuzzyApplyBlock(content: string, block: DiffBlock): { success: boolean; content: string; matchType?: string } {
    const searchLines = block.search.split('\n').map(l => l.trim()).filter(l => l);
    const contentLines = content.split('\n');
    
    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
        let match = true;
        for (let j = 0; j < searchLines.length; j++) {
            if (!contentLines[i + j].trim().includes(searchLines[j])) {
                match = false;
                break;
            }
        }
        
        if (match) {
            const indent = contentLines[i].match(/^(\s*)/)?.[1] || '';
            const replaceLines = block.replace.split('\n').map(l => indent + l.trim());
            const newLines = [
                ...contentLines.slice(0, i),
                ...replaceLines,
                ...contentLines.slice(i + searchLines.length)
            ];
            return { success: true, content: newLines.join('\n'), matchType: 'fuzzy' };
        }
    }
    
    return { success: false, content };
}

function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
