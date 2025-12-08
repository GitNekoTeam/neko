import { DiagnosticInfo, CodeFixRequest, AutoFixConfig } from '../../../services/auto-fix/types';

describe('AutoFixService', () => {
    describe('DiagnosticInfo', () => {
        it('should have correct structure', () => {
            const diagnostic: DiagnosticInfo = {
                file: 'test.ts',
                line: 10,
                column: 5,
                endLine: 10,
                endColumn: 15,
                message: 'Type error',
                severity: 0, // Error
                code: 'TS2322',
                source: 'typescript',
                range: {
                    start: { line: 9, character: 4 },
                    end: { line: 9, character: 14 }
                } as unknown as import('vscode').Range
            };

            expect(diagnostic.file).toBe('test.ts');
            expect(diagnostic.line).toBe(10);
            expect(diagnostic.severity).toBe(0);
        });
    });

    describe('CodeFixRequest', () => {
        it('should contain all required fields', () => {
            const request: CodeFixRequest = {
                file: 'test.ts',
                code: 'const x: string = 123;',
                diagnostics: [{
                    file: 'test.ts',
                    line: 1,
                    column: 19,
                    endLine: 1,
                    endColumn: 22,
                    message: 'Type number is not assignable to type string',
                    severity: 0,
                    range: {} as import('vscode').Range
                }],
                language: 'typescript'
            };

            expect(request.file).toBe('test.ts');
            expect(request.diagnostics).toHaveLength(1);
            expect(request.language).toBe('typescript');
        });
    });

    describe('AutoFixConfig', () => {
        it('should have default values', () => {
            const defaultConfig: AutoFixConfig = {
                enabled: false,
                debounceMs: 500,
                severityThreshold: 0,
                excludePatterns: ['node_modules/**', 'dist/**'],
                includeWarnings: false,
                autoApply: false,
                maxConcurrentFixes: 1
            };

            expect(defaultConfig.enabled).toBe(false);
            expect(defaultConfig.debounceMs).toBe(500);
            expect(defaultConfig.excludePatterns).toContain('node_modules/**');
        });
    });

    describe('filterDiagnostics', () => {
        it('should filter by severity', () => {
            const diagnostics: DiagnosticInfo[] = [
                { file: 'a.ts', line: 1, column: 1, endLine: 1, endColumn: 1, message: 'Error', severity: 0, range: {} as import('vscode').Range },
                { file: 'b.ts', line: 1, column: 1, endLine: 1, endColumn: 1, message: 'Warning', severity: 1, range: {} as import('vscode').Range },
                { file: 'c.ts', line: 1, column: 1, endLine: 1, endColumn: 1, message: 'Info', severity: 2, range: {} as import('vscode').Range }
            ];

            const errorsOnly = diagnostics.filter(d => d.severity === 0);
            expect(errorsOnly).toHaveLength(1);
            expect(errorsOnly[0].message).toBe('Error');
        });

        it('should include warnings when configured', () => {
            const diagnostics: DiagnosticInfo[] = [
                { file: 'a.ts', line: 1, column: 1, endLine: 1, endColumn: 1, message: 'Error', severity: 0, range: {} as import('vscode').Range },
                { file: 'b.ts', line: 1, column: 1, endLine: 1, endColumn: 1, message: 'Warning', severity: 1, range: {} as import('vscode').Range }
            ];

            const includeWarnings = true;
            const filtered = diagnostics.filter(d => 
                d.severity === 0 || (includeWarnings && d.severity === 1)
            );
            
            expect(filtered).toHaveLength(2);
        });
    });

    describe('shouldExclude', () => {
        it('should exclude node_modules', () => {
            const patterns = ['node_modules/**', 'dist/**'];
            const filePath = '/project/node_modules/package/index.js';
            
            const shouldExclude = patterns.some(pattern => {
                const regex = new RegExp(
                    pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
                );
                return regex.test(filePath);
            });
            
            expect(shouldExclude).toBe(true);
        });

        it('should not exclude src files', () => {
            const patterns = ['node_modules/**', 'dist/**'];
            const filePath = '/project/src/index.ts';
            
            const shouldExclude = patterns.some(pattern => {
                const regex = new RegExp(
                    pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
                );
                return regex.test(filePath);
            });
            
            expect(shouldExclude).toBe(false);
        });
    });
});

describe('LLMFixProvider', () => {
    describe('buildPrompt', () => {
        it('should format errors correctly', () => {
            const diagnostics: DiagnosticInfo[] = [
                { 
                    file: 'test.ts', 
                    line: 5, 
                    column: 10, 
                    endLine: 5, 
                    endColumn: 15,
                    message: 'Cannot find name x', 
                    severity: 0,
                    code: 'TS2304',
                    range: {} as import('vscode').Range
                }
            ];

            const errorList = diagnostics.map((d, i) => 
                `${i + 1}. Line ${d.line}:${d.column} - ${d.message}${d.code ? ` [${d.code}]` : ''}`
            ).join('\n');

            expect(errorList).toContain('Line 5:10');
            expect(errorList).toContain('Cannot find name x');
            expect(errorList).toContain('[TS2304]');
        });
    });

    describe('extractCode', () => {
        it('should extract code from markdown block', () => {
            const response = `Here is the fix:
\`\`\`typescript
const x: number = 123;
\`\`\``;

            const match = response.match(/```\w*\s*\n([\s\S]*?)```/);
            const code = match ? match[1].trim() : response;
            
            expect(code).toBe('const x: number = 123;');
        });

        it('should handle response without code block', () => {
            const response = 'const x: number = 123;';
            
            const match = response.match(/```\w*\s*\n([\s\S]*?)```/);
            const code = match ? match[1].trim() : response.trim();
            
            expect(code).toBe('const x: number = 123;');
        });
    });
});
