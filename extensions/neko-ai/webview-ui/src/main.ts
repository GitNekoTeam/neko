interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolName?: string;
    isError?: boolean;
}

interface ContextItem {
    type: 'file' | 'selection' | 'terminal' | 'diagnostic';
    label: string;
    content: string;
    filePath?: string;
}

interface WebviewMessage {
    type: string;
    message?: ChatMessage;
    id?: string;
    content?: string;
    item?: ContextItem;
    error?: string;
    messages?: ChatMessage[];
    sessions?: SessionPreview[];
}

interface SessionPreview {
    id: string;
    preview: string;
    createdAt: number;
}

class NekoWebview {
    private vscode: VsCodeApi;
    private messagesEl: HTMLElement;
    private inputEl: HTMLTextAreaElement;
    private sendBtn: HTMLButtonElement;
    private emptyState: HTMLElement | null;
    private contextBar: HTMLElement;
    private isLoading = false;
    private contextItems: ContextItem[] = [];
    private currentStreamId: string | null = null;

    constructor() {
        this.vscode = acquireVsCodeApi();
        this.messagesEl = document.getElementById('messages') as HTMLElement;
        this.inputEl = document.getElementById('input') as HTMLTextAreaElement;
        this.sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
        this.emptyState = document.getElementById('emptyState');
        this.contextBar = document.getElementById('contextBar') as HTMLElement;

        this.init();
    }

    private init(): void {
        this.bindEvents();
        this.restoreState();
    }

    private bindEvents(): void {
        this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeydown(e));
        this.inputEl.addEventListener('input', () => this.autoResize());
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        window.addEventListener('message', (event: MessageEvent<WebviewMessage>) => {
            this.handleMessage(event.data);
        });

        document.querySelectorAll('.suggestion').forEach((el) => {
            el.addEventListener('click', () => {
                const text = el.textContent || '';
                this.useSuggestion(text);
            });
        });

        const newChatBtn = document.querySelector('[data-action="newChat"]');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.newChat());
        }

        const settingsBtn = document.querySelector('[data-action="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
    }

    private restoreState(): void {
        const state = this.vscode.getState() as { messages?: ChatMessage[] } | null;
        if (state?.messages) {
            state.messages.forEach((msg) => this.addMessage(msg));
        }
    }

    private saveState(messages: ChatMessage[]): void {
        this.vscode.setState({ messages });
    }

    sendMessage(): void {
        const content = this.inputEl.value.trim();
        if (!content || this.isLoading) return;

        const userMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now()
        };

        this.addMessage(userMessage);

        this.vscode.postMessage({
            type: 'sendMessage',
            content,
            context: this.contextItems
        });

        this.inputEl.value = '';
        this.autoResize();
        this.contextItems = [];
        this.updateContextBar();
        this.setLoading(true);
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.sendMessage();
        }

        if (e.key === 'Escape' && this.isLoading) {
            this.cancelRequest();
        }
    }

    private autoResize(): void {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 200) + 'px';
    }

    newChat(): void {
        this.vscode.postMessage({ type: 'newChat' });
        this.clearMessages();
    }

    private openSettings(): void {
        this.vscode.postMessage({ type: 'openSettings' });
    }

    private cancelRequest(): void {
        this.vscode.postMessage({ type: 'cancelRequest' });
        this.setLoading(false);
    }

    private useSuggestion(text: string): void {
        this.inputEl.value = text + ' ';
        this.inputEl.focus();
        this.autoResize();
    }

    private setLoading(loading: boolean): void {
        this.isLoading = loading;
        this.sendBtn.disabled = loading;

        if (loading) {
            this.showTypingIndicator();
        } else {
            this.hideTypingIndicator();
        }
    }

    private showTypingIndicator(): void {
        const existing = document.getElementById('typingIndicator');
        if (existing) return;

        const typingEl = document.createElement('div');
        typingEl.className = 'message assistant';
        typingEl.id = 'typingIndicator';
        typingEl.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.messagesEl.appendChild(typingEl);
        this.scrollToBottom();
    }

    private hideTypingIndicator(): void {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.remove();
        }
    }

    private addMessage(msg: ChatMessage): void {
        if (this.emptyState) {
            this.emptyState.style.display = 'none';
        }

        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        div.id = msg.id;

        if (msg.isError) {
            div.classList.add('error');
        }

        if (msg.toolName) {
            div.setAttribute('data-tool', msg.toolName);
        }

        div.innerHTML = this.formatContent(msg.content);
        this.messagesEl.appendChild(div);
        this.scrollToBottom();
    }

    private updateMessage(id: string, content: string): void {
        let el = document.getElementById(id);

        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'message assistant';
            this.messagesEl.appendChild(el);
        }

        el.innerHTML = this.formatContent(content);
        this.scrollToBottom();
    }

    private clearMessages(): void {
        this.messagesEl.innerHTML = '';
        if (this.emptyState) {
            this.messagesEl.appendChild(this.emptyState);
            this.emptyState.style.display = 'flex';
        }
    }

    private formatContent(content: string): string {
        let formatted = content;

        formatted = formatted.replace(
            /```(\w*)\n([\s\S]*?)```/g,
            (_, lang: string, code: string) => {
                const escapedCode = this.escapeHtml(code);
                return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
            }
        );

        formatted = formatted.replace(
            /`([^`]+)`/g,
            (_, code: string) => `<code>${this.escapeHtml(code)}</code>`
        );

        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private scrollToBottom(): void {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    addContext(item: ContextItem): void {
        this.contextItems.push(item);
        this.updateContextBar();
    }

    removeContext(index: number): void {
        this.contextItems.splice(index, 1);
        this.updateContextBar();
    }

    private updateContextBar(): void {
        this.contextBar.innerHTML = this.contextItems
            .map((item, i) => `
                <span class="context-tag" data-index="${i}">
                    <span class="context-icon">${this.getContextIcon(item.type)}</span>
                    ${this.escapeHtml(item.label)}
                    <span class="remove" data-remove="${i}">x</span>
                </span>
            `)
            .join('');

        this.contextBar.querySelectorAll('[data-remove]').forEach((el) => {
            el.addEventListener('click', (e) => {
                const index = parseInt((e.target as HTMLElement).getAttribute('data-remove') || '0', 10);
                this.removeContext(index);
            });
        });
    }

    private getContextIcon(type: ContextItem['type']): string {
        const icons: Record<ContextItem['type'], string> = {
            file: '#',
            selection: '[]',
            terminal: '>_',
            diagnostic: '!'
        };
        return icons[type] || '#';
    }

    private handleMessage(message: WebviewMessage): void {
        switch (message.type) {
            case 'addMessage':
                this.setLoading(false);
                if (message.message) {
                    this.addMessage(message.message);
                }
                break;

            case 'updateMessage':
                if (message.id && message.content) {
                    this.updateMessage(message.id, message.content);
                }
                break;

            case 'streamStart':
                this.currentStreamId = message.id || `stream_${Date.now()}`;
                this.hideTypingIndicator();
                break;

            case 'streamChunk':
                if (message.content) {
                    this.updateMessage(this.currentStreamId || 'streaming', message.content);
                }
                break;

            case 'streamEnd':
                this.setLoading(false);
                this.currentStreamId = null;
                break;

            case 'clear':
                this.clearMessages();
                break;

            case 'addContext':
                if (message.item) {
                    this.addContext(message.item);
                }
                break;

            case 'error':
                this.setLoading(false);
                if (message.error) {
                    this.addMessage({
                        id: `error_${Date.now()}`,
                        role: 'system',
                        content: message.error,
                        timestamp: Date.now(),
                        isError: true
                    });
                }
                break;

            case 'loadMessages':
                this.clearMessages();
                if (message.messages) {
                    message.messages.forEach((msg) => this.addMessage(msg));
                }
                break;

            case 'focus':
                this.inputEl.focus();
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    (window as unknown as { nekoWebview: NekoWebview }).nekoWebview = new NekoWebview();
});
