import * as vscode from 'vscode';
import * as path from 'path';
import { Task } from '../task/TaskManager';

export interface PersistedTask extends Task {
    messages: TaskMessage[];
    files: TaskFile[];
    checkpointId?: string;
}

export interface TaskMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolName?: string;
    toolResult?: unknown;
}

export interface TaskFile {
    path: string;
    action: 'created' | 'modified' | 'deleted';
    timestamp: number;
    previousContent?: string;
}

export interface TaskSession {
    id: string;
    name: string;
    tasks: string[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}

export class TaskPersistence {
    private context: vscode.ExtensionContext;
    private storageDir: string;
    private sessions: Map<string, TaskSession> = new Map();
    private tasks: Map<string, PersistedTask> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storageDir = path.join(context.globalStorageUri.fsPath, 'tasks');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.storageDir));
        } catch {
            // Directory may already exist
        }
        await this.loadSessions();
    }

    private async loadSessions(): Promise<void> {
        const sessionsData = this.context.globalState.get<TaskSession[]>('taskSessions');
        if (sessionsData) {
            for (const session of sessionsData) {
                this.sessions.set(session.id, session);
            }
        }
    }

    async createSession(name: string): Promise<TaskSession> {
        const id = this.generateId('session');
        const session: TaskSession = {
            id,
            name,
            tasks: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.sessions.set(id, session);
        await this.saveSessions();
        return session;
    }

    async saveTask(task: PersistedTask, sessionId?: string): Promise<void> {
        this.tasks.set(task.id, task);

        const taskPath = path.join(this.storageDir, `${task.id}.json`);
        const content = JSON.stringify(task, null, 2);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(taskPath),
            Buffer.from(content, 'utf-8')
        );

        if (sessionId) {
            const session = this.sessions.get(sessionId);
            if (session && !session.tasks.includes(task.id)) {
                session.tasks.push(task.id);
                session.updatedAt = Date.now();
                await this.saveSessions();
            }
        }
    }

    async loadTask(taskId: string): Promise<PersistedTask | undefined> {
        if (this.tasks.has(taskId)) {
            return this.tasks.get(taskId);
        }

        try {
            const taskPath = path.join(this.storageDir, `${taskId}.json`);
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(taskPath));
            const task = JSON.parse(Buffer.from(content).toString('utf-8')) as PersistedTask;
            this.tasks.set(taskId, task);
            return task;
        } catch {
            return undefined;
        }
    }

    async deleteTask(taskId: string): Promise<boolean> {
        this.tasks.delete(taskId);

        try {
            const taskPath = path.join(this.storageDir, `${taskId}.json`);
            await vscode.workspace.fs.delete(vscode.Uri.file(taskPath));
        } catch {
            // File may not exist
        }

        for (const session of this.sessions.values()) {
            const index = session.tasks.indexOf(taskId);
            if (index >= 0) {
                session.tasks.splice(index, 1);
                session.updatedAt = Date.now();
            }
        }
        await this.saveSessions();

        return true;
    }

    async addMessage(taskId: string, message: Omit<TaskMessage, 'id' | 'timestamp'>): Promise<TaskMessage> {
        const task = await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const taskMessage: TaskMessage = {
            ...message,
            id: this.generateId('msg'),
            timestamp: Date.now()
        };

        task.messages.push(taskMessage);
        await this.saveTask(task);

        return taskMessage;
    }

    async addFileChange(taskId: string, file: Omit<TaskFile, 'timestamp'>): Promise<void> {
        const task = await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const taskFile: TaskFile = {
            ...file,
            timestamp: Date.now()
        };

        task.files.push(taskFile);
        await this.saveTask(task);
    }

    getSession(sessionId: string): TaskSession | undefined {
        return this.sessions.get(sessionId);
    }

    getAllSessions(): TaskSession[] {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getSessionTasks(sessionId: string): Promise<PersistedTask[]> {
        const session = this.sessions.get(sessionId);
        if (!session) return [];

        const tasks: PersistedTask[] = [];
        for (const taskId of session.tasks) {
            const task = await this.loadTask(taskId);
            if (task) {
                tasks.push(task);
            }
        }
        return tasks;
    }

    async deleteSession(sessionId: string, deleteTasks: boolean = false): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        if (deleteTasks) {
            for (const taskId of session.tasks) {
                await this.deleteTask(taskId);
            }
        }

        this.sessions.delete(sessionId);
        await this.saveSessions();
    }

    async exportSession(sessionId: string): Promise<string> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const tasks = await this.getSessionTasks(sessionId);
        const exportData = {
            session,
            tasks,
            exportedAt: Date.now()
        };

        return JSON.stringify(exportData, null, 2);
    }

    async importSession(data: string): Promise<TaskSession> {
        const importData = JSON.parse(data);
        const session = importData.session as TaskSession;
        const tasks = importData.tasks as PersistedTask[];

        session.id = this.generateId('session');
        session.createdAt = Date.now();
        session.updatedAt = Date.now();
        session.tasks = [];

        this.sessions.set(session.id, session);

        for (const task of tasks) {
            const newTaskId = this.generateId('task');
            task.id = newTaskId;
            task.createdAt = Date.now();
            session.tasks.push(newTaskId);
            await this.saveTask(task, session.id);
        }

        await this.saveSessions();
        return session;
    }

    async getRecentTasks(limit: number = 10): Promise<PersistedTask[]> {
        const allTasks: PersistedTask[] = [];
        
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.storageDir));
            for (const [name] of files) {
                if (name.endsWith('.json')) {
                    const taskId = name.replace('.json', '');
                    const task = await this.loadTask(taskId);
                    if (task) {
                        allTasks.push(task);
                    }
                }
            }
        } catch {
            // Directory may not exist
        }

        return allTasks
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    async cleanup(olderThanDays: number = 30): Promise<number> {
        const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        let deleted = 0;

        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.storageDir));
            for (const [name] of files) {
                if (name.endsWith('.json')) {
                    const taskId = name.replace('.json', '');
                    const task = await this.loadTask(taskId);
                    if (task && task.createdAt < cutoff && task.status !== 'running') {
                        await this.deleteTask(taskId);
                        deleted++;
                    }
                }
            }
        } catch {
            // Directory may not exist
        }

        return deleted;
    }

    private async saveSessions(): Promise<void> {
        const sessions = Array.from(this.sessions.values());
        await this.context.globalState.update('taskSessions', sessions);
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}
