import * as vscode from 'vscode';

export interface ContextItem {
    id: string;
    type: 'file' | 'folder' | 'symbol' | 'selection' | 'terminal' | 'diagnostic' | 'url' | 'git';
    name: string;
    content: string;
    uri?: string;
    range?: { start: number; end: number };
    metadata?: Record<string, unknown>;
    timestamp: number;
    tokens?: number;
}

export interface ContextWindow {
    items: ContextItem[];
    maxTokens: number;
    currentTokens: number;
}

export class ContextManager {
    private items: Map<string, ContextItem> = new Map();
    private maxTokens: number = 100000;
    private currentTokens: number = 0;
    private priorityOrder: string[] = [];

    constructor(maxTokens?: number) {
        if (maxTokens) {
            this.maxTokens = maxTokens;
        }
    }

    addItem(item: Omit<ContextItem, 'id' | 'timestamp' | 'tokens'>): ContextItem {
        const id = this.generateId(item);
        const tokens = this.estimateTokens(item.content);
        
        const contextItem: ContextItem = {
            ...item,
            id,
            timestamp: Date.now(),
            tokens
        };

        if (this.items.has(id)) {
            const existing = this.items.get(id)!;
            this.currentTokens -= existing.tokens || 0;
        }

        while (this.currentTokens + tokens > this.maxTokens && this.items.size > 0) {
            this.removeOldestItem();
        }

        this.items.set(id, contextItem);
        this.currentTokens += tokens;
        this.updatePriority(id);

        return contextItem;
    }

    removeItem(id: string): boolean {
        const item = this.items.get(id);
        if (item) {
            this.currentTokens -= item.tokens || 0;
            this.items.delete(id);
            this.priorityOrder = this.priorityOrder.filter(i => i !== id);
            return true;
        }
        return false;
    }

    getItem(id: string): ContextItem | undefined {
        return this.items.get(id);
    }

    getAllItems(): ContextItem[] {
        return Array.from(this.items.values());
    }

    getItemsByType(type: ContextItem['type']): ContextItem[] {
        return this.getAllItems().filter(item => item.type === type);
    }

    clear(): void {
        this.items.clear();
        this.currentTokens = 0;
        this.priorityOrder = [];
    }

    getWindow(): ContextWindow {
        return {
            items: this.getAllItems(),
            maxTokens: this.maxTokens,
            currentTokens: this.currentTokens
        };
    }

    buildContextString(): string {
        const sections: string[] = [];
        const itemsByType = new Map<string, ContextItem[]>();

        for (const item of this.getAllItems()) {
            if (!itemsByType.has(item.type)) {
                itemsByType.set(item.type, []);
            }
            itemsByType.get(item.type)!.push(item);
        }

        if (itemsByType.has('file')) {
            sections.push('## Files in Context\n');
            for (const item of itemsByType.get('file')!) {
                sections.push(`### ${item.name}\n\`\`\`\n${item.content}\n\`\`\`\n`);
            }
        }

        if (itemsByType.has('selection')) {
            sections.push('## Selected Code\n');
            for (const item of itemsByType.get('selection')!) {
                sections.push(`### ${item.name}\n\`\`\`\n${item.content}\n\`\`\`\n`);
            }
        }

        if (itemsByType.has('terminal')) {
            sections.push('## Terminal Output\n');
            for (const item of itemsByType.get('terminal')!) {
                sections.push(`\`\`\`\n${item.content}\n\`\`\`\n`);
            }
        }

        if (itemsByType.has('diagnostic')) {
            sections.push('## Diagnostics/Problems\n');
            for (const item of itemsByType.get('diagnostic')!) {
                sections.push(`- ${item.name}: ${item.content}\n`);
            }
        }

        if (itemsByType.has('git')) {
            sections.push('## Git Information\n');
            for (const item of itemsByType.get('git')!) {
                sections.push(`${item.content}\n`);
            }
        }

        return sections.join('\n');
    }

    async addFromEditor(editor: vscode.TextEditor): Promise<ContextItem> {
        const document = editor.document;
        const selection = editor.selection;
        
        if (!selection.isEmpty) {
            return this.addItem({
                type: 'selection',
                name: `${document.fileName} (selection)`,
                content: document.getText(selection),
                uri: document.uri.toString(),
                range: {
                    start: document.offsetAt(selection.start),
                    end: document.offsetAt(selection.end)
                }
            });
        }

        return this.addItem({
            type: 'file',
            name: document.fileName,
            content: document.getText(),
            uri: document.uri.toString()
        });
    }

    async addDiagnostics(uri: vscode.Uri): Promise<ContextItem[]> {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const items: ContextItem[] = [];

        for (const diagnostic of diagnostics) {
            const item = this.addItem({
                type: 'diagnostic',
                name: `${uri.fsPath}:${diagnostic.range.start.line + 1}`,
                content: diagnostic.message,
                uri: uri.toString(),
                metadata: {
                    severity: diagnostic.severity,
                    source: diagnostic.source
                }
            });
            items.push(item);
        }

        return items;
    }

    private generateId(item: Omit<ContextItem, 'id' | 'timestamp' | 'tokens'>): string {
        return `${item.type}:${item.uri || item.name}`;
    }

    private estimateTokens(content: string): number {
        return Math.ceil(content.length / 4);
    }

    private removeOldestItem(): void {
        if (this.priorityOrder.length === 0) return;
        
        const oldestId = this.priorityOrder[0];
        this.removeItem(oldestId);
    }

    private updatePriority(id: string): void {
        this.priorityOrder = this.priorityOrder.filter(i => i !== id);
        this.priorityOrder.push(id);
    }

    setMaxTokens(maxTokens: number): void {
        this.maxTokens = maxTokens;
        while (this.currentTokens > this.maxTokens && this.items.size > 0) {
            this.removeOldestItem();
        }
    }

    getStats(): { itemCount: number; tokenCount: number; maxTokens: number; utilization: number } {
        return {
            itemCount: this.items.size,
            tokenCount: this.currentTokens,
            maxTokens: this.maxTokens,
            utilization: this.currentTokens / this.maxTokens
        };
    }
}
