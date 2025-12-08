import * as vscode from 'vscode';
import { BaseProvider, Message } from '../../api/providers/BaseProvider';
import { CodeIndexManager } from '../../services/code-index/CodeIndexManager';
import { TerminalService } from '../../services/terminal/TerminalService';
import { BrowserService } from '../../services/browser/BrowserService';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ChatHistoryManager } from '../../services/history/ChatHistoryManager';
import { MentionProvider } from '../mentions/MentionProvider';
import { RulesManager } from '../../services/rules/RulesManager';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolName?: string;
}

interface ChatSession {
    id: string;
    messages: ChatMessage[];
    createdAt: number;
}

export class NekoProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private apiProvider: BaseProvider;
    private codeIndexManager: CodeIndexManager;
    private terminalService: TerminalService;
    private browserService: BrowserService;
    private toolRegistry: ToolRegistry;
    private chatHistoryManager?: ChatHistoryManager;
    private mentionProvider?: MentionProvider;
    private rulesManager?: RulesManager;
    private view: vscode.WebviewView | undefined;
    private currentSession: ChatSession;
    private sessions: ChatSession[] = [];

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel,
        apiProvider: BaseProvider,
        codeIndexManager: CodeIndexManager,
        terminalService: TerminalService,
        browserService: BrowserService,
        toolRegistry?: ToolRegistry,
        chatHistoryManager?: ChatHistoryManager,
        mentionProvider?: MentionProvider,
        rulesManager?: RulesManager
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.apiProvider = apiProvider;
        this.codeIndexManager = codeIndexManager;
        this.terminalService = terminalService;
        this.browserService = browserService;
        this.toolRegistry = toolRegistry || new ToolRegistry(
            outputChannel, codeIndexManager, terminalService, browserService
        );
        this.chatHistoryManager = chatHistoryManager;
        this.mentionProvider = mentionProvider;
        this.rulesManager = rulesManager;
        this.currentSession = this.createNewSession();
        this.loadSessions();
    }

    private createNewSession(): ChatSession {
        return {
            id: `session_${Date.now()}`,
            messages: [],
            createdAt: Date.now()
        };
    }

    private async loadSessions(): Promise<void> {
        const stored = this.context.globalState.get<ChatSession[]>('neko-ai.sessions');
        if (stored) {
            this.sessions = stored;
            if (this.sessions.length > 0) {
                this.currentSession = this.sessions[0];
            }
        }
    }

    private async saveSessions(): Promise<void> {
        await this.context.globalState.update('neko-ai.sessions', this.sessions);
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async (message: { type: string; [key: string]: unknown }) => {
            await this.handleMessage(message);
        });

        this.updateWebview();
    }

    private async handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
        switch (message.type) {
            case 'sendMessage':
                await this.handleUserMessage(message.content as string);
                break;
            case 'newChat':
                this.newChat();
                break;
            case 'clearChat':
                this.clearChat();
                break;
            case 'executeCommand':
                await this.executeCommand(message.command as string);
                break;
            case 'searchCodebase':
                await this.searchCodebase(message.query as string);
                break;
            case 'openBrowser':
                await this.browserService.openBrowserPanel();
                break;
        }
    }

    private async handleUserMessage(content: string): Promise<void> {
        let mentionContext = '';
        if (this.mentionProvider) {
            const mentions = this.mentionProvider.parseMentions(content);
            if (mentions.length > 0) {
                const resolvedMentions = await this.mentionProvider.resolveMentions(mentions);
                mentionContext = resolvedMentions.map(m => m.content).join('\n\n');
            }
        }

        const userMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now()
        };

        this.currentSession.messages.push(userMessage);
        this.updateWebview();

        if (this.chatHistoryManager) {
            await this.chatHistoryManager.addMessage({ role: 'user', content });
        }

        try {
            const context = await this.buildContext(content);
            const fullContext = mentionContext ? `${mentionContext}\n\n${context}` : context;
            const messages: Message[] = [
                { role: 'system', content: this.buildSystemPrompt(fullContext) },
                ...this.currentSession.messages.map(m => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content
                }))
            ];

            let assistantContent = '';
            const assistantMessage: ChatMessage = {
                id: `msg_${Date.now() + 1}`,
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };
            this.currentSession.messages.push(assistantMessage);

            await this.apiProvider.completeStream(
                { messages, maxTokens: 4096 },
                (chunk) => {
                    assistantContent += chunk;
                    assistantMessage.content = assistantContent;
                    this.updateWebview();
                }
            );

            await this.processAssistantResponse(assistantContent);
            
            if (this.chatHistoryManager) {
                await this.chatHistoryManager.addMessage({ role: 'assistant', content: assistantContent });
            }
            
            await this.saveSessions();
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now() + 2}`,
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now()
            };
            this.currentSession.messages.push(errorMessage);
            this.updateWebview();
        }
    }

    private async buildContext(query: string): Promise<string> {
        let context = '';

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            if (!selection.isEmpty) {
                const selectedText = editor.document.getText(selection);
                context += `\n\nSelected code in ${editor.document.fileName}:\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``;
            } else {
                const currentFile = editor.document.getText();
                if (currentFile.length < 10000) {
                    context += `\n\nCurrent file ${editor.document.fileName}:\n\`\`\`${editor.document.languageId}\n${currentFile}\n\`\`\``;
                }
            }
        }

        const searchResults = await this.codeIndexManager.search(query, 3);
        if (searchResults.length > 0) {
            context += '\n\nRelevant code from codebase:';
            for (const result of searchResults) {
                context += `\n\nFile: ${result.file} (lines ${result.startLine}-${result.endLine}):\n\`\`\`\n${result.content}\n\`\`\``;
            }
        }

        return context;
    }

    private buildSystemPrompt(context: string): string {
        const availableTools = this.toolRegistry.getDefinitions();
        const toolsDescription = availableTools.map((t: { name: string; description: string }) => `- ${t.name}: ${t.description}`).join('\n');
        
        const rulesPrompt = this.rulesManager?.buildRulesPrompt() || '';
        
        return `You are Neko AI, an intelligent coding assistant integrated into a code editor. You help developers write, understand, debug, and improve code.

Your capabilities:
- Explain code and concepts
- Write and modify code
- Debug issues
- Execute terminal commands (use <execute>command</execute> tags)
- Search the codebase
- Interact with browser for debugging (screenshots, console logs, network requests)

Available tools:
${toolsDescription}

Guidelines:
- Be concise and helpful
- Provide working code examples
- Explain your reasoning when helpful
- Use markdown formatting for code blocks
- When executing commands, explain what they do first

${rulesPrompt ? `Project Rules:\n${rulesPrompt}\n\n` : ''}${context}`;
    }

    private async processAssistantResponse(content: string): Promise<void> {
        const executeRegex = /<execute>([\s\S]*?)<\/execute>/g;
        let match;

        while ((match = executeRegex.exec(content)) !== null) {
            const command = match[1].trim();
            this.outputChannel.appendLine(`Executing command: ${command}`);
            
            const result = await this.terminalService.executeCommand(command);
            
            const resultMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                role: 'system',
                content: `Command output:\n\`\`\`\n${result.output}\n\`\`\`\nExit code: ${result.exitCode}`,
                timestamp: Date.now()
            };
            this.currentSession.messages.push(resultMessage);
            this.updateWebview();
        }
    }

    newChat(): void {
        if (this.currentSession.messages.length > 0) {
            if (!this.sessions.find(s => s.id === this.currentSession.id)) {
                this.sessions.unshift(this.currentSession);
            }
        }
        this.currentSession = this.createNewSession();
        this.updateWebview();
        this.saveSessions();
    }

    clearChat(): void {
        this.currentSession.messages = [];
        this.updateWebview();
    }

    async addToContext(text: string, filePath: string): Promise<void> {
        const message = `Context from ${filePath}:\n\`\`\`\n${text}\n\`\`\``;
        this.view?.webview.postMessage({ type: 'addContext', content: message });
    }

    private async executeCommand(command: string): Promise<void> {
        const result = await this.terminalService.runWithProgress(
            command,
            `Executing: ${command.slice(0, 30)}...`
        );

        const resultMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'system',
            content: `Command: ${command}\nOutput:\n\`\`\`\n${result.output}\n\`\`\`\nExit code: ${result.exitCode}`,
            timestamp: Date.now()
        };
        this.currentSession.messages.push(resultMessage);
        this.updateWebview();
    }

    private async searchCodebase(query: string): Promise<void> {
        const results = await this.codeIndexManager.search(query, 10);
        this.view?.webview.postMessage({ type: 'searchResults', results });
    }

    private updateWebview(): void {
        this.view?.webview.postMessage({
            type: 'update',
            messages: this.currentSession.messages,
            sessions: this.sessions.map(s => ({
                id: s.id,
                preview: s.messages[0]?.content.slice(0, 50) || 'New chat',
                createdAt: s.createdAt
            }))
        });
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neko AI</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: var(--vscode-font-family); 
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 5px;
        }
        .header button {
            padding: 5px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 3px;
        }
        .header button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
        }
        .message.user {
            background: var(--vscode-input-background);
            margin-left: 20px;
        }
        .message.assistant {
            background: var(--vscode-editor-inactiveSelectionBackground);
            margin-right: 20px;
        }
        .message.system {
            background: var(--vscode-editorWidget-background);
            font-size: 0.9em;
            opacity: 0.8;
        }
        .message pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 10px 0;
        }
        .message code {
            font-family: var(--vscode-editor-font-family);
        }
        .input-area {
            padding: 10px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .input-area textarea {
            width: 100%;
            min-height: 60px;
            padding: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
        }
        .input-area textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .input-area button {
            margin-top: 5px;
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <button onclick="newChat()">New Chat</button>
        <button onclick="clearChat()">Clear</button>
        <button onclick="openBrowser()">Browser</button>
    </div>
    <div class="messages" id="messages"></div>
    <div class="input-area">
        <textarea id="input" placeholder="Ask Neko AI..." onkeydown="handleKeydown(event)"></textarea>
        <button onclick="sendMessage()">Send</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');

        function sendMessage() {
            const content = inputEl.value.trim();
            if (!content) return;
            vscode.postMessage({ type: 'sendMessage', content });
            inputEl.value = '';
        }

        function handleKeydown(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                sendMessage();
            }
        }

        function newChat() { vscode.postMessage({ type: 'newChat' }); }
        function clearChat() { vscode.postMessage({ type: 'clearChat' }); }
        function openBrowser() { vscode.postMessage({ type: 'openBrowser' }); }

        function renderMessage(msg) {
            const div = document.createElement('div');
            div.className = 'message ' + msg.role;
            div.innerHTML = formatContent(msg.content);
            return div;
        }

        function formatContent(content) {
            return content
                .replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                .replace(/\\n/g, '<br>');
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                messagesEl.innerHTML = '';
                message.messages.forEach(msg => {
                    messagesEl.appendChild(renderMessage(msg));
                });
                messagesEl.scrollTop = messagesEl.scrollHeight;
            } else if (message.type === 'addContext') {
                inputEl.value += '\\n' + message.content;
            }
        });
    </script>
</body>
</html>`;
    }
}
