import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    taskId?: string;
    mode: string;
    provider: string;
    model: string;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
}

export interface SessionMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    tokens?: number;
    cost?: number;
    toolCalls?: SessionToolCall[];
}

export interface SessionToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output?: string;
    status: 'pending' | 'success' | 'error';
}

export interface SessionServiceOptions {
    storagePath: string;
    maxSessions?: number;
}

export class SessionService {
    private storagePath: string;
    private maxSessions: number;
    private sessions: Map<string, Session> = new Map();
    private currentSessionId: string | null = null;

    constructor(options: SessionServiceOptions) {
        this.storagePath = options.storagePath;
        this.maxSessions = options.maxSessions || 100;
    }

    async initialize(): Promise<void> {
        await this.ensureStorageDirectory();
        await this.loadSessions();
    }

    private async ensureStorageDirectory(): Promise<void> {
        const sessionsDir = path.join(this.storagePath, 'sessions');
        await fs.mkdir(sessionsDir, { recursive: true });
    }

    private async loadSessions(): Promise<void> {
        const sessionsDir = path.join(this.storagePath, 'sessions');

        try {
            const files = await fs.readdir(sessionsDir);
            const sessionFiles = files.filter(f => f.endsWith('.json') && !f.includes('_messages'));

            for (const file of sessionFiles) {
                try {
                    const content = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
                    const session = JSON.parse(content) as Session;
                    this.sessions.set(session.id, session);
                } catch (error) {
                    console.warn(`Failed to load session ${file}:`, error);
                }
            }
        } catch (error) {
            console.warn('Failed to load sessions:', error);
        }
    }

    async createSession(options: {
        name?: string;
        mode: string;
        provider: string;
        model: string;
    }): Promise<Session> {
        const session: Session = {
            id: uuidv4(),
            name: options.name || `Session ${this.sessions.size + 1}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            mode: options.mode,
            provider: options.provider,
            model: options.model,
            messageCount: 0,
            totalTokens: 0,
            totalCost: 0
        };

        this.sessions.set(session.id, session);
        this.currentSessionId = session.id;

        await this.saveSession(session);
        await this.pruneOldSessions();

        return session;
    }

    async getSession(sessionId: string): Promise<Session | null> {
        return this.sessions.get(sessionId) || null;
    }

    async getCurrentSession(): Promise<Session | null> {
        if (!this.currentSessionId) {
            return null;
        }
        return this.getSession(this.currentSessionId);
    }

    setCurrentSession(sessionId: string): void {
        if (this.sessions.has(sessionId)) {
            this.currentSessionId = sessionId;
        }
    }

    async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const updatedSession = {
            ...session,
            ...updates,
            updatedAt: Date.now()
        };

        this.sessions.set(sessionId, updatedSession);
        await this.saveSession(updatedSession);

        return updatedSession;
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        this.sessions.delete(sessionId);

        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }

        const sessionFile = path.join(this.storagePath, 'sessions', `${sessionId}.json`);
        const messagesFile = path.join(this.storagePath, 'sessions', `${sessionId}_messages.json`);

        try {
            await fs.unlink(sessionFile);
            await fs.unlink(messagesFile).catch(() => {});
            return true;
        } catch {
            return false;
        }
    }

    async getAllSessions(): Promise<Session[]> {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'sessionId'>): Promise<SessionMessage> {
        const fullMessage: SessionMessage = {
            ...message,
            id: uuidv4(),
            sessionId
        };

        const messages = await this.getMessages(sessionId);
        messages.push(fullMessage);
        await this.saveMessages(sessionId, messages);

        await this.updateSession(sessionId, {
            messageCount: messages.length,
            totalTokens: (await this.getSession(sessionId))?.totalTokens || 0 + (message.tokens || 0),
            totalCost: (await this.getSession(sessionId))?.totalCost || 0 + (message.cost || 0)
        });

        return fullMessage;
    }

    async getMessages(sessionId: string): Promise<SessionMessage[]> {
        const messagesFile = path.join(this.storagePath, 'sessions', `${sessionId}_messages.json`);

        try {
            const content = await fs.readFile(messagesFile, 'utf-8');
            return JSON.parse(content) as SessionMessage[];
        } catch {
            return [];
        }
    }

    private async saveSession(session: Session): Promise<void> {
        const sessionFile = path.join(this.storagePath, 'sessions', `${session.id}.json`);
        await fs.writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
    }

    private async saveMessages(sessionId: string, messages: SessionMessage[]): Promise<void> {
        const messagesFile = path.join(this.storagePath, 'sessions', `${sessionId}_messages.json`);
        await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), 'utf-8');
    }

    private async pruneOldSessions(): Promise<void> {
        if (this.sessions.size <= this.maxSessions) {
            return;
        }

        const sortedSessions = Array.from(this.sessions.values())
            .sort((a, b) => a.updatedAt - b.updatedAt);

        const sessionsToDelete = sortedSessions.slice(0, this.sessions.size - this.maxSessions);

        for (const session of sessionsToDelete) {
            await this.deleteSession(session.id);
        }
    }
}
