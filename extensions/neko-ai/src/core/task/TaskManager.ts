import * as vscode from 'vscode';

export interface Task {
    id: string;
    name: string;
    description?: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    metadata?: Record<string, unknown>;
    parentId?: string;
    subtasks?: string[];
}

export interface TaskResult {
    taskId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    duration: number;
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();
    private context: vscode.ExtensionContext;
    private onTaskUpdateCallbacks: ((task: Task) => void)[] = [];
    private runningTasks: Set<string> = new Set();
    private maxConcurrentTasks: number = 5;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadTasks();
    }

    private async loadTasks(): Promise<void> {
        const savedTasks = this.context.workspaceState.get<Task[]>('tasks');
        if (savedTasks) {
            for (const task of savedTasks) {
                if (task.status === 'running') {
                    task.status = 'paused';
                }
                this.tasks.set(task.id, task);
            }
        }
    }

    createTask(name: string, description?: string, parentId?: string): Task {
        const id = this.generateId();
        const task: Task = {
            id,
            name,
            description,
            status: 'pending',
            progress: 0,
            createdAt: Date.now(),
            parentId
        };

        this.tasks.set(id, task);

        if (parentId) {
            const parent = this.tasks.get(parentId);
            if (parent) {
                parent.subtasks = parent.subtasks || [];
                parent.subtasks.push(id);
            }
        }

        this.saveTasks();
        this.notifyUpdate(task);
        return task;
    }

    async startTask(taskId: string): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        if (this.runningTasks.size >= this.maxConcurrentTasks) {
            return false;
        }

        task.status = 'running';
        task.startedAt = Date.now();
        this.runningTasks.add(taskId);
        
        this.saveTasks();
        this.notifyUpdate(task);
        return true;
    }

    updateProgress(taskId: string, progress: number, metadata?: Record<string, unknown>): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.progress = Math.min(100, Math.max(0, progress));
        if (metadata) {
            task.metadata = { ...task.metadata, ...metadata };
        }

        this.notifyUpdate(task);
    }

    completeTask(taskId: string, result?: unknown): TaskResult {
        const task = this.tasks.get(taskId);
        if (!task) {
            return { taskId, success: false, error: 'Task not found', duration: 0 };
        }

        task.status = 'completed';
        task.progress = 100;
        task.completedAt = Date.now();
        task.metadata = { ...task.metadata, result };
        this.runningTasks.delete(taskId);

        const duration = task.startedAt ? task.completedAt - task.startedAt : 0;

        this.saveTasks();
        this.notifyUpdate(task);

        return { taskId, success: true, result, duration };
    }

    failTask(taskId: string, error: string): TaskResult {
        const task = this.tasks.get(taskId);
        if (!task) {
            return { taskId, success: false, error: 'Task not found', duration: 0 };
        }

        task.status = 'failed';
        task.error = error;
        task.completedAt = Date.now();
        this.runningTasks.delete(taskId);

        const duration = task.startedAt ? task.completedAt - task.startedAt : 0;

        this.saveTasks();
        this.notifyUpdate(task);

        return { taskId, success: false, error, duration };
    }

    pauseTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'running') return false;

        task.status = 'paused';
        this.runningTasks.delete(taskId);

        this.saveTasks();
        this.notifyUpdate(task);
        return true;
    }

    async resumeTask(taskId: string): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'paused') return false;

        return this.startTask(taskId);
    }

    cancelTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.status = 'cancelled';
        task.completedAt = Date.now();
        this.runningTasks.delete(taskId);

        if (task.subtasks) {
            for (const subtaskId of task.subtasks) {
                this.cancelTask(subtaskId);
            }
        }

        this.saveTasks();
        this.notifyUpdate(task);
        return true;
    }

    getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    getAllTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    getTasksByStatus(status: Task['status']): Task[] {
        return this.getAllTasks().filter(t => t.status === status);
    }

    getRunningTasks(): Task[] {
        return this.getTasksByStatus('running');
    }

    getPendingTasks(): Task[] {
        return this.getTasksByStatus('pending');
    }

    getSubtasks(taskId: string): Task[] {
        const task = this.tasks.get(taskId);
        if (!task?.subtasks) return [];

        return task.subtasks
            .map(id => this.tasks.get(id))
            .filter((t): t is Task => t !== undefined);
    }

    deleteTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        if (task.subtasks) {
            for (const subtaskId of task.subtasks) {
                this.deleteTask(subtaskId);
            }
        }

        if (task.parentId) {
            const parent = this.tasks.get(task.parentId);
            if (parent?.subtasks) {
                parent.subtasks = parent.subtasks.filter(id => id !== taskId);
            }
        }

        this.tasks.delete(taskId);
        this.runningTasks.delete(taskId);
        this.saveTasks();
        return true;
    }

    clearCompletedTasks(): number {
        let count = 0;
        for (const [id, task] of this.tasks) {
            if (task.status === 'completed' || task.status === 'cancelled') {
                this.tasks.delete(id);
                count++;
            }
        }
        this.saveTasks();
        return count;
    }

    onTaskUpdate(callback: (task: Task) => void): vscode.Disposable {
        this.onTaskUpdateCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onTaskUpdateCallbacks.indexOf(callback);
            if (index >= 0) this.onTaskUpdateCallbacks.splice(index, 1);
        });
    }

    private notifyUpdate(task: Task): void {
        for (const callback of this.onTaskUpdateCallbacks) {
            try {
                callback(task);
            } catch {
                // Ignore callback errors
            }
        }
    }

    private async saveTasks(): Promise<void> {
        const tasks = Array.from(this.tasks.values());
        await this.context.workspaceState.update('tasks', tasks);
    }

    private generateId(): string {
        return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    getStats(): { total: number; running: number; pending: number; completed: number; failed: number } {
        const tasks = this.getAllTasks();
        return {
            total: tasks.length,
            running: tasks.filter(t => t.status === 'running').length,
            pending: tasks.filter(t => t.status === 'pending').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length
        };
    }
}
