import { describe, it, expect } from 'vitest';
import { createUnifiedDiff, applyDiff, computeDiff } from '../../utils/diff';

describe('diff', () => {
    describe('createUnifiedDiff', () => {
        it('should create diff for simple changes', () => {
            const original = 'line 1\nline 2\nline 3';
            const modified = 'line 1\nmodified line 2\nline 3';
            const result = createUnifiedDiff('test.txt', 'test.txt', original, modified);
            
            expect(result).toContain('test.txt');
            expect(result).toContain('-line 2');
            expect(result).toContain('+modified line 2');
        });

        it('should handle identical content', () => {
            const content = 'same content';
            const result = createUnifiedDiff('test.txt', 'test.txt', content, content);
            expect(result).not.toContain('\n-same');
            expect(result).not.toContain('\n+same');
        });

        it('should handle additions', () => {
            const original = 'line 1';
            const modified = 'line 1\nline 2';
            const result = createUnifiedDiff('test.txt', 'test.txt', original, modified);
            expect(result).toContain('+line 2');
        });

        it('should handle deletions', () => {
            const original = 'line 1\nline 2';
            const modified = 'line 1';
            const result = createUnifiedDiff('test.txt', 'test.txt', original, modified);
            expect(result).toContain('-line 2');
        });
    });

    describe('computeDiff', () => {
        it('should compute line differences', () => {
            const original = 'line 1\nline 2';
            const modified = 'line 1\nmodified';
            const changes = computeDiff(original, modified);
            
            expect(changes.length).toBeGreaterThan(0);
        });
    });

    describe('applyDiff', () => {
        it('should apply patch to original', () => {
            const original = 'line 1\nline 2\nline 3';
            const modified = 'line 1\nmodified\nline 3';
            const patch = createUnifiedDiff('test.txt', 'test.txt', original, modified);
            
            const result = applyDiff(original, patch);
            expect(result).toContain('modified');
        });
    });
});
