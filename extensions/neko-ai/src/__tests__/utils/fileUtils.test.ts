import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        fs: {
            readFile: vi.fn(),
            stat: vi.fn()
        }
    },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        parse: (path: string) => ({ fsPath: path })
    }
}));

import { 
    getAbsolutePath, 
    isTextFile, 
    isBinaryFile
} from '../../utils/fileUtils';

describe('fileUtils', () => {
    describe('getAbsolutePath', () => {
        it('should return absolute path for relative path', () => {
            const result = getAbsolutePath('src/test.ts', '/workspace');
            expect(result).toBe('/workspace/src/test.ts');
        });

        it('should handle already absolute paths', () => {
            const result = getAbsolutePath('/absolute/path.ts', '/workspace');
            expect(result).toBe('/absolute/path.ts');
        });
    });

    describe('isTextFile', () => {
        it('should return true for text files', () => {
            expect(isTextFile('test.ts')).toBe(true);
            expect(isTextFile('test.js')).toBe(true);
            expect(isTextFile('test.json')).toBe(true);
            expect(isTextFile('test.md')).toBe(true);
            expect(isTextFile('test.txt')).toBe(true);
        });

        it('should return false for binary files', () => {
            expect(isTextFile('test.png')).toBe(false);
            expect(isTextFile('test.jpg')).toBe(false);
            expect(isTextFile('test.exe')).toBe(false);
        });
    });

    describe('isBinaryFile', () => {
        it('should return true for binary files', () => {
            expect(isBinaryFile('test.png')).toBe(true);
            expect(isBinaryFile('test.jpg')).toBe(true);
            expect(isBinaryFile('test.gif')).toBe(true);
            expect(isBinaryFile('test.pdf')).toBe(true);
        });

        it('should return false for text files', () => {
            expect(isBinaryFile('test.ts')).toBe(false);
            expect(isBinaryFile('test.js')).toBe(false);
        });
    });


});
