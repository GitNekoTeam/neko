import { CodeFixRequest, DiagnosticInfo, LLMFixProvider } from './types';

export class DefaultLLMFixProvider implements LLMFixProvider {
    constructor(
        private apiHandler: (prompt: string) => Promise<string>
    ) {}

    public async generateFix(request: CodeFixRequest): Promise<string> {
        const prompt = this.buildPrompt(request);
        const response = await this.apiHandler(prompt);
        return this.extractCode(response, request.language);
    }

    private buildPrompt(request: CodeFixRequest): string {
        const errorList = this.formatErrors(request.diagnostics);
        
        return `Fix the following ${request.language} code errors.

Errors:
${errorList}

Code:
\`\`\`${request.language}
${request.code}
\`\`\`

Return ONLY the fixed code in a code block, no explanations.`;
    }

    private formatErrors(diagnostics: DiagnosticInfo[]): string {
        return diagnostics.map((d, i) => 
            `${i + 1}. Line ${d.line}:${d.column} - ${d.message}${d.code ? ` [${d.code}]` : ''}`
        ).join('\n');
    }

    private extractCode(response: string, language: string): string {
        const patterns = [
            new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\`\`\``, 'i'),
            /```\w*\s*\n([\s\S]*?)```/,
            /```([\s\S]*?)```/
        ];

        for (const pattern of patterns) {
            const match = response.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return response.trim();
    }
}

export class StreamingLLMFixProvider implements LLMFixProvider {
    constructor(
        private streamHandler: (prompt: string, onChunk: (chunk: string) => void) => Promise<void>
    ) {}

    public async generateFix(request: CodeFixRequest): Promise<string> {
        const prompt = this.buildPrompt(request);
        let response = '';

        await this.streamHandler(prompt, chunk => {
            response += chunk;
        });

        return this.extractCode(response, request.language);
    }

    private buildPrompt(request: CodeFixRequest): string {
        const errors = request.diagnostics.map(d => 
            `L${d.line}: ${d.message}`
        ).join('; ');

        return `Fix ${request.language} errors: ${errors}\n\n\`\`\`${request.language}\n${request.code}\n\`\`\`\n\nReturn fixed code only.`;
    }

    private extractCode(response: string, _language: string): string {
        const match = response.match(/```[\w]*\s*\n([\s\S]*?)```/);
        return match ? match[1].trim() : response.trim();
    }
}
