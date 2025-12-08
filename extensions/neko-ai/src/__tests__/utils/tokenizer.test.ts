import { describe, it, expect } from 'vitest';
import { countTokens, truncateToTokens, splitIntoChunks, estimateTokens } from '../../utils/tokenizer';

describe('tokenizer', () => {
    describe('countTokens', () => {
        it('should count tokens in a simple string', async () => {
            const text = 'Hello world';
            const count = await countTokens(text);
            expect(count).toBeGreaterThan(0);
        });

        it('should return 0 for empty string', async () => {
            expect(await countTokens('')).toBe(0);
        });

        it('should handle code snippets', async () => {
            const code = 'function hello() { return "world"; }';
            const count = await countTokens(code);
            expect(count).toBeGreaterThan(5);
        });
    });

    describe('truncateToTokens', () => {
        it('should not truncate text under limit', async () => {
            const text = 'Short text';
            const result = await truncateToTokens(text, 100);
            expect(result).toBe(text);
        });

        it('should truncate text over limit', async () => {
            const text = 'A'.repeat(10000);
            const result = await truncateToTokens(text, 100);
            expect(result.length).toBeLessThan(text.length);
        });
    });

    describe('splitIntoChunks', () => {
        it('should split text into chunks', async () => {
            const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
            const chunks = await splitIntoChunks(text, 10);
            expect(chunks.length).toBeGreaterThan(0);
        });

        it('should preserve content', async () => {
            const text = 'Hello\nWorld';
            const chunks = await splitIntoChunks(text, 1000);
            const joined = chunks.join('\n');
            expect(joined).toContain('Hello');
            expect(joined).toContain('World');
        });
    });

    describe('estimateTokens', () => {
        it('should estimate tokens based on character count', () => {
            const text = 'Hello world';
            const estimate = estimateTokens(text);
            expect(estimate).toBe(Math.ceil(text.length / 4));
        });
    });
});
