import * as vscode from 'vscode';

export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: SyntaxNode[];
}

export interface CodeSymbol {
    name: string;
    kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'enum' | 'constant';
    range: vscode.Range;
    detail?: string;
    children?: CodeSymbol[];
}

export interface CodeStructure {
    imports: string[];
    exports: string[];
    classes: CodeSymbol[];
    functions: CodeSymbol[];
    variables: CodeSymbol[];
    interfaces: CodeSymbol[];
    types: CodeSymbol[];
}

export class TreeSitterService implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private initialized = false;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    async initialize(): Promise<boolean> {
        try {
            this.initialized = true;
            this.outputChannel.appendLine('TreeSitter service initialized (using VS Code symbols)');
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize TreeSitter: ${error}`);
            return false;
        }
    }

    async getSymbols(document: vscode.TextDocument): Promise<CodeSymbol[]> {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );

        if (!symbols) {
            return [];
        }

        return this.convertSymbols(symbols);
    }

    private convertSymbols(symbols: vscode.DocumentSymbol[]): CodeSymbol[] {
        return symbols.map(s => ({
            name: s.name,
            kind: this.convertSymbolKind(s.kind),
            range: s.range,
            detail: s.detail,
            children: s.children ? this.convertSymbols(s.children) : undefined
        }));
    }

    private convertSymbolKind(kind: vscode.SymbolKind): CodeSymbol['kind'] {
        switch (kind) {
            case vscode.SymbolKind.Function:
                return 'function';
            case vscode.SymbolKind.Class:
                return 'class';
            case vscode.SymbolKind.Method:
                return 'method';
            case vscode.SymbolKind.Variable:
                return 'variable';
            case vscode.SymbolKind.Interface:
                return 'interface';
            case vscode.SymbolKind.TypeParameter:
                return 'type';
            case vscode.SymbolKind.Enum:
                return 'enum';
            case vscode.SymbolKind.Constant:
                return 'constant';
            default:
                return 'variable';
        }
    }

    async getCodeStructure(document: vscode.TextDocument): Promise<CodeStructure> {
        const symbols = await this.getSymbols(document);
        const text = document.getText();
        const lines = text.split('\n');

        const structure: CodeStructure = {
            imports: [],
            exports: [],
            classes: [],
            functions: [],
            variables: [],
            interfaces: [],
            types: []
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
                structure.imports.push(trimmed);
            }
            if (trimmed.startsWith('export ')) {
                structure.exports.push(trimmed);
            }
        }

        for (const symbol of symbols) {
            switch (symbol.kind) {
                case 'class':
                    structure.classes.push(symbol);
                    break;
                case 'function':
                case 'method':
                    structure.functions.push(symbol);
                    break;
                case 'variable':
                case 'constant':
                    structure.variables.push(symbol);
                    break;
                case 'interface':
                    structure.interfaces.push(symbol);
                    break;
                case 'type':
                    structure.types.push(symbol);
                    break;
            }
        }

        return structure;
    }

    async getFunctionAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<CodeSymbol | undefined> {
        const symbols = await this.getSymbols(document);
        return this.findSymbolAtPosition(symbols, position, ['function', 'method']);
    }

    async getClassAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<CodeSymbol | undefined> {
        const symbols = await this.getSymbols(document);
        return this.findSymbolAtPosition(symbols, position, ['class']);
    }

    private findSymbolAtPosition(
        symbols: CodeSymbol[],
        position: vscode.Position,
        kinds: CodeSymbol['kind'][]
    ): CodeSymbol | undefined {
        for (const sym of symbols) {
            if (sym.range.contains(position)) {
                if (kinds.includes(sym.kind)) {
                    if (sym.children) {
                        const child = this.findSymbolAtPosition(sym.children, position, kinds);
                        if (child) {
                            return child;
                        }
                    }
                    return sym;
                }
                if (sym.children) {
                    const child = this.findSymbolAtPosition(sym.children, position, kinds);
                    if (child) {
                        return child;
                    }
                }
            }
        }
        return undefined;
    }

    formatStructureForPrompt(structure: CodeStructure): string {
        let output = '## Code Structure\n\n';

        if (structure.imports.length > 0) {
            output += '### Imports\n';
            output += structure.imports.slice(0, 10).join('\n') + '\n\n';
        }

        if (structure.classes.length > 0) {
            output += '### Classes\n';
            for (const cls of structure.classes) {
                output += `- ${cls.name}`;
                if (cls.detail) {
                    output += ` (${cls.detail})`;
                }
                output += '\n';
                if (cls.children) {
                    for (const child of cls.children.slice(0, 5)) {
                        output += `  - ${child.kind}: ${child.name}\n`;
                    }
                }
            }
            output += '\n';
        }

        if (structure.functions.length > 0) {
            output += '### Functions\n';
            for (const fn of structure.functions.slice(0, 20)) {
                output += `- ${fn.name}`;
                if (fn.detail) {
                    output += `: ${fn.detail}`;
                }
                output += '\n';
            }
            output += '\n';
        }

        if (structure.interfaces.length > 0) {
            output += '### Interfaces\n';
            for (const iface of structure.interfaces) {
                output += `- ${iface.name}\n`;
            }
            output += '\n';
        }

        if (structure.types.length > 0) {
            output += '### Types\n';
            for (const type of structure.types) {
                output += `- ${type.name}\n`;
            }
            output += '\n';
        }

        return output;
    }

    async getOutline(document: vscode.TextDocument): Promise<string> {
        const structure = await this.getCodeStructure(document);
        return this.formatStructureForPrompt(structure);
    }

    dispose(): void {
        // Cleanup
    }
}
