import * as vscode from 'vscode';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: {
        model?: string;
        tokens?: number;
        toolCalls?: string[];
    };
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    metadata?: {
        workspaceFolder?: string;
        model?: string;
    };
}

export interface ChatHistoryIndex {
    sessions: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        messageCount: number;
    }[];
    version: number;
}

export class ChatHistoryManager {
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private storageUri: vscode.Uri;
    private currentSession: ChatSession | null = null;
    private index: ChatHistoryIndex = { sessions: [], version: 1 };

    constructor(outputChannel: vscode.OutputChannel, context: vscode.ExtensionContext) {
        this.outputChannel = outputChannel;
        this.context = context;
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'chat-history');
    }

    async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await this.loadIndex();
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize chat history: ${error}`);
        }
    }

    private async loadIndex(): Promise<void> {
        try {
            const indexUri = vscode.Uri.joinPath(this.storageUri, 'index.json');
            const data = await vscode.workspace.fs.readFile(indexUri);
            this.index = JSON.parse(Buffer.from(data).toString('utf-8'));
        } catch {
            this.index = { sessions: [], version: 1 };
        }
    }

    private async saveIndex(): Promise<void> {
        try {
            const indexUri = vscode.Uri.joinPath(this.storageUri, 'index.json');
            const data = Buffer.from(JSON.stringify(this.index, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(indexUri, data);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to save index: ${error}`);
        }
    }

    async createSession(title?: string): Promise<ChatSession> {
        const session: ChatSession = {
            id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: title || `Chat ${new Date().toLocaleString()}`,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
                workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.name
            }
        };

        this.currentSession = session;
        await this.saveSession(session);

        this.index.sessions.unshift({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: 0
        });

        await this.saveIndex();
        return session;
    }

    async addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
        if (!this.currentSession) {
            await this.createSession();
        }

        const fullMessage: ChatMessage = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };

        this.currentSession!.messages.push(fullMessage);
        this.currentSession!.updatedAt = Date.now();

        if (this.currentSession!.messages.length === 1 && message.role === 'user') {
            this.currentSession!.title = this.generateTitle(message.content);
            const indexEntry = this.index.sessions.find(s => s.id === this.currentSession!.id);
            if (indexEntry) {
                indexEntry.title = this.currentSession!.title;
            }
        }

        await this.saveSession(this.currentSession!);
        await this.updateIndexEntry(this.currentSession!);

        return fullMessage;
    }

    private generateTitle(content: string): string {
        const cleaned = content.replace(/[@#]\w+:?\S*/g, '').trim();
        const firstLine = cleaned.split('\n')[0];
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine || 'New Chat';
    }

    private async saveSession(session: ChatSession): Promise<void> {
        try {
            const sessionUri = vscode.Uri.joinPath(this.storageUri, `${session.id}.json`);
            const data = Buffer.from(JSON.stringify(session, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(sessionUri, data);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to save session: ${error}`);
        }
    }

    private async updateIndexEntry(session: ChatSession): Promise<void> {
        const entry = this.index.sessions.find(s => s.id === session.id);
        if (entry) {
            entry.updatedAt = session.updatedAt;
            entry.messageCount = session.messages.length;
            entry.title = session.title;
            await this.saveIndex();
        }
    }

    async loadSession(sessionId: string): Promise<ChatSession | null> {
        try {
            const sessionUri = vscode.Uri.joinPath(this.storageUri, `${sessionId}.json`);
            const data = await vscode.workspace.fs.readFile(sessionUri);
            const session = JSON.parse(Buffer.from(data).toString('utf-8')) as ChatSession;
            this.currentSession = session;
            return session;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to load session ${sessionId}: ${error}`);
            return null;
        }
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        try {
            const sessionUri = vscode.Uri.joinPath(this.storageUri, `${sessionId}.json`);
            await vscode.workspace.fs.delete(sessionUri);

            this.index.sessions = this.index.sessions.filter(s => s.id !== sessionId);
            await this.saveIndex();

            if (this.currentSession?.id === sessionId) {
                this.currentSession = null;
            }

            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to delete session ${sessionId}: ${error}`);
            return false;
        }
    }

    async listSessions(limit: number = 50): Promise<ChatHistoryIndex['sessions']> {
        return this.index.sessions.slice(0, limit);
    }

    async searchSessions(query: string): Promise<ChatHistoryIndex['sessions']> {
        const lowerQuery = query.toLowerCase();
        return this.index.sessions.filter(s => 
            s.title.toLowerCase().includes(lowerQuery)
        );
    }

    async exportSession(sessionId: string): Promise<string | null> {
        const session = await this.loadSession(sessionId);
        if (!session) return null;

        const lines: string[] = [
            `# ${session.title}`,
            `Created: ${new Date(session.createdAt).toLocaleString()}`,
            '',
            '---',
            ''
        ];

        for (const message of session.messages) {
            const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
            lines.push(`## ${role}`);
            lines.push('');
            lines.push(message.content);
            lines.push('');
        }

        return lines.join('\n');
    }

    async importSession(markdown: string): Promise<ChatSession | null> {
        try {
            const lines = markdown.split('\n');
            const title = lines[0]?.replace(/^#\s*/, '') || 'Imported Chat';
            
            const session = await this.createSession(title);
            
            let currentRole: 'user' | 'assistant' | 'system' | null = null;
            let currentContent: string[] = [];

            for (const line of lines.slice(4)) {
                if (line.startsWith('## User')) {
                    if (currentRole && currentContent.length > 0) {
                        await this.addMessage({
                            role: currentRole,
                            content: currentContent.join('\n').trim()
                        });
                    }
                    currentRole = 'user';
                    currentContent = [];
                } else if (line.startsWith('## Assistant')) {
                    if (currentRole && currentContent.length > 0) {
                        await this.addMessage({
                            role: currentRole,
                            content: currentContent.join('\n').trim()
                        });
                    }
                    currentRole = 'assistant';
                    currentContent = [];
                } else if (line.startsWith('## System')) {
                    if (currentRole && currentContent.length > 0) {
                        await this.addMessage({
                            role: currentRole,
                            content: currentContent.join('\n').trim()
                        });
                    }
                    currentRole = 'system';
                    currentContent = [];
                } else if (currentRole) {
                    currentContent.push(line);
                }
            }

            if (currentRole && currentContent.length > 0) {
                await this.addMessage({
                    role: currentRole,
                    content: currentContent.join('\n').trim()
                });
            }

            return session;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to import session: ${error}`);
            return null;
        }
    }

    getCurrentSession(): ChatSession | null {
        return this.currentSession;
    }

    async clearCurrentSession(): Promise<void> {
        this.currentSession = null;
    }

    async clearAllHistory(): Promise<void> {
        try {
            for (const session of this.index.sessions) {
                const sessionUri = vscode.Uri.joinPath(this.storageUri, `${session.id}.json`);
                try {
                    await vscode.workspace.fs.delete(sessionUri);
                } catch {
                    // Ignore individual file deletion errors
                }
            }

            this.index = { sessions: [], version: 1 };
            await this.saveIndex();
            this.currentSession = null;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to clear history: ${error}`);
        }
    }
}
