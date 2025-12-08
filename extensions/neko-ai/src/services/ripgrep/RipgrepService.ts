import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export interface SearchMatch {
    file: string;
    line: number;
    column: number;
    content: string;
    matchStart: number;
    matchEnd: number;
}

export interface SearchOptions {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
    includePattern?: string[];
    excludePattern?: string[];
    maxResults?: number;
    contextLines?: number;
}

export class RipgrepService implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private rgPath: string | undefined;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.findRipgrep();
    }

    private findRipgrep(): void {
        const rgPathFromVscode = vscode.workspace.getConfiguration('search').get<string>('ripgrepPath');
        if (rgPathFromVscode) {
            this.rgPath = rgPathFromVscode;
            return;
        }

        const vscodeRgPath = path.join(
            vscode.env.appRoot,
            'node_modules',
            '@vscode',
            'ripgrep',
            'bin',
            process.platform === 'win32' ? 'rg.exe' : 'rg'
        );

        this.rgPath = vscodeRgPath;
    }

    async search(
        pattern: string,
        workspacePath: string,
        options: SearchOptions = {}
    ): Promise<SearchMatch[]> {
        if (!this.rgPath) {
            this.outputChannel.appendLine('Ripgrep not found, falling back to basic search');
            return this.fallbackSearch(pattern, workspacePath, options);
        }

        return new Promise((resolve) => {
            const args = this.buildArgs(pattern, options);
            const matches: SearchMatch[] = [];
            let output = '';

            this.outputChannel.appendLine(`Running ripgrep: ${this.rgPath} ${args.join(' ')}`);

            const proc = spawn(this.rgPath!, args, {
                cwd: workspacePath,
                env: process.env
            });

            proc.stdout?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                this.outputChannel.appendLine(`Ripgrep stderr: ${data.toString()}`);
            });

            proc.on('close', () => {
                const lines = output.split('\n').filter(l => l.trim());
                
                for (const line of lines) {
                    const match = this.parseJsonLine(line, workspacePath);
                    if (match) {
                        matches.push(match);
                        if (options.maxResults && matches.length >= options.maxResults) {
                            break;
                        }
                    }
                }

                resolve(matches);
            });

            proc.on('error', (error: Error) => {
                this.outputChannel.appendLine(`Ripgrep error: ${error.message}`);
                resolve([]);
            });
        });
    }

    private buildArgs(pattern: string, options: SearchOptions): string[] {
        const args = [
            '--json',
            '--line-number',
            '--column',
            '--no-heading'
        ];

        if (!options.caseSensitive) {
            args.push('--ignore-case');
        }

        if (options.wholeWord) {
            args.push('--word-regexp');
        }

        if (!options.regex) {
            args.push('--fixed-strings');
        }

        if (options.contextLines) {
            args.push('--context', options.contextLines.toString());
        }

        if (options.includePattern) {
            for (const include of options.includePattern) {
                args.push('--glob', include);
            }
        }

        if (options.excludePattern) {
            for (const exclude of options.excludePattern) {
                args.push('--glob', `!${exclude}`);
            }
        }

        args.push('--glob', '!node_modules/**');
        args.push('--glob', '!.git/**');
        args.push('--glob', '!dist/**');
        args.push('--glob', '!build/**');
        args.push('--glob', '!*.min.js');
        args.push('--glob', '!*.min.css');

        if (options.maxResults) {
            args.push('--max-count', options.maxResults.toString());
        }

        args.push('--', pattern, '.');

        return args;
    }

    private parseJsonLine(line: string, workspacePath: string): SearchMatch | null {
        try {
            const json = JSON.parse(line);
            
            if (json.type === 'match') {
                const data = json.data;
                const filePath = path.join(workspacePath, data.path.text);
                
                return {
                    file: filePath,
                    line: data.line_number,
                    column: data.submatches[0]?.start || 0,
                    content: data.lines.text.trim(),
                    matchStart: data.submatches[0]?.start || 0,
                    matchEnd: data.submatches[0]?.end || 0
                };
            }
        } catch {
            // Not JSON, try to parse as plain text
            const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
            if (match) {
                return {
                    file: path.join(workspacePath, match[1]),
                    line: parseInt(match[2], 10),
                    column: parseInt(match[3], 10),
                    content: match[4].trim(),
                    matchStart: 0,
                    matchEnd: 0
                };
            }
        }
        return null;
    }

    private async fallbackSearch(
        pattern: string,
        workspacePath: string,
        options: SearchOptions
    ): Promise<SearchMatch[]> {
        const matches: SearchMatch[] = [];
        const files = await vscode.workspace.findFiles(
            options.includePattern?.[0] || '**/*',
            options.excludePattern?.[0] || '**/node_modules/**'
        );

        const regex = options.regex 
            ? new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
            : new RegExp(this.escapeRegex(pattern), options.caseSensitive ? 'g' : 'gi');

        for (const file of files) {
            if (options.maxResults && matches.length >= options.maxResults) {
                break;
            }

            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    let match;
                    
                    while ((match = regex.exec(line)) !== null) {
                        matches.push({
                            file: file.fsPath,
                            line: i + 1,
                            column: match.index + 1,
                            content: line.trim(),
                            matchStart: match.index,
                            matchEnd: match.index + match[0].length
                        });

                        if (options.maxResults && matches.length >= options.maxResults) {
                            return matches;
                        }
                    }
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return matches;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatResultsForPrompt(matches: SearchMatch[], maxResults = 20): string {
        if (matches.length === 0) {
            return 'No matches found.';
        }

        const limited = matches.slice(0, maxResults);
        let output = `Found ${matches.length} match(es)`;
        if (matches.length > maxResults) {
            output += ` (showing first ${maxResults})`;
        }
        output += ':\n\n';

        const grouped = new Map<string, SearchMatch[]>();
        for (const match of limited) {
            const existing = grouped.get(match.file) || [];
            existing.push(match);
            grouped.set(match.file, existing);
        }

        for (const [file, fileMatches] of grouped) {
            output += `**${file}**\n`;
            for (const match of fileMatches) {
                output += `  Line ${match.line}: ${match.content}\n`;
            }
            output += '\n';
        }

        return output;
    }

    dispose(): void {
        // Cleanup if needed
    }
}
