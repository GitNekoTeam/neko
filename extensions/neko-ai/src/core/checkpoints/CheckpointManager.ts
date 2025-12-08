import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface FileCheckpoint {
    path: string;
    content: string;
    timestamp: number;
}

interface Checkpoint {
    id: string;
    name: string;
    description?: string;
    files: FileCheckpoint[];
    timestamp: number;
}

export class CheckpointManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private checkpoints: Checkpoint[] = [];
    private maxCheckpoints = 50;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.loadCheckpoints();
    }

    private async loadCheckpoints(): Promise<void> {
        const stored = this.context.globalState.get<Checkpoint[]>('neko-ai.checkpoints');
        if (stored) {
            this.checkpoints = stored;
            this.outputChannel.appendLine(`Loaded ${this.checkpoints.length} checkpoints`);
        }
    }

    private async saveCheckpoints(): Promise<void> {
        await this.context.globalState.update('neko-ai.checkpoints', this.checkpoints);
    }

    async createCheckpoint(name: string, files: string[], description?: string): Promise<Checkpoint> {
        const fileCheckpoints: FileCheckpoint[] = [];

        for (const filePath of files) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                fileCheckpoints.push({
                    path: filePath,
                    content,
                    timestamp: Date.now()
                });
            } catch (error) {
                this.outputChannel.appendLine(`Failed to read file for checkpoint: ${filePath}`);
            }
        }

        const checkpoint: Checkpoint = {
            id: `checkpoint_${Date.now()}`,
            name,
            description,
            files: fileCheckpoints,
            timestamp: Date.now()
        };

        this.checkpoints.unshift(checkpoint);

        if (this.checkpoints.length > this.maxCheckpoints) {
            this.checkpoints = this.checkpoints.slice(0, this.maxCheckpoints);
        }

        await this.saveCheckpoints();
        this.outputChannel.appendLine(`Created checkpoint: ${name} with ${files.length} files`);

        return checkpoint;
    }

    async createAutoCheckpoint(files: string[]): Promise<Checkpoint> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return this.createCheckpoint(`Auto-${timestamp}`, files, 'Automatic checkpoint before AI changes');
    }

    async restoreCheckpoint(checkpointId: string): Promise<boolean> {
        const checkpoint = this.checkpoints.find(c => c.id === checkpointId);
        if (!checkpoint) {
            this.outputChannel.appendLine(`Checkpoint not found: ${checkpointId}`);
            return false;
        }

        const currentFiles: string[] = [];
        for (const file of checkpoint.files) {
            currentFiles.push(file.path);
        }
        await this.createCheckpoint(`Before-Restore-${checkpoint.name}`, currentFiles, 'Checkpoint before restore');

        for (const file of checkpoint.files) {
            try {
                const dir = path.dirname(file.path);
                await fs.promises.mkdir(dir, { recursive: true });
                await fs.promises.writeFile(file.path, file.content, 'utf-8');
                this.outputChannel.appendLine(`Restored: ${file.path}`);
            } catch (error) {
                this.outputChannel.appendLine(`Failed to restore file: ${file.path}`);
            }
        }

        this.outputChannel.appendLine(`Restored checkpoint: ${checkpoint.name}`);
        return true;
    }

    async restoreFile(checkpointId: string, filePath: string): Promise<boolean> {
        const checkpoint = this.checkpoints.find(c => c.id === checkpointId);
        if (!checkpoint) {
            return false;
        }

        const file = checkpoint.files.find(f => f.path === filePath);
        if (!file) {
            return false;
        }

        try {
            await this.createAutoCheckpoint([filePath]);
            await fs.promises.writeFile(file.path, file.content, 'utf-8');
            this.outputChannel.appendLine(`Restored file: ${filePath} from checkpoint: ${checkpoint.name}`);
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to restore file: ${filePath}`);
            return false;
        }
    }

    getCheckpoints(): Checkpoint[] {
        return [...this.checkpoints];
    }

    getCheckpoint(id: string): Checkpoint | undefined {
        return this.checkpoints.find(c => c.id === id);
    }

    async deleteCheckpoint(id: string): Promise<boolean> {
        const index = this.checkpoints.findIndex(c => c.id === id);
        if (index === -1) {
            return false;
        }

        this.checkpoints.splice(index, 1);
        await this.saveCheckpoints();
        return true;
    }

    async clearOldCheckpoints(maxAge: number): Promise<number> {
        const cutoff = Date.now() - maxAge;
        const originalLength = this.checkpoints.length;
        this.checkpoints = this.checkpoints.filter(c => c.timestamp > cutoff);
        const removed = originalLength - this.checkpoints.length;
        
        if (removed > 0) {
            await this.saveCheckpoints();
            this.outputChannel.appendLine(`Cleared ${removed} old checkpoints`);
        }
        
        return removed;
    }

    async showCheckpointDiff(checkpointId: string, filePath: string): Promise<void> {
        const checkpoint = this.checkpoints.find(c => c.id === checkpointId);
        if (!checkpoint) {
            vscode.window.showErrorMessage('Checkpoint not found');
            return;
        }

        const file = checkpoint.files.find(f => f.path === filePath);
        if (!file) {
            vscode.window.showErrorMessage('File not found in checkpoint');
            return;
        }

        const checkpointUri = vscode.Uri.parse(`neko-checkpoint:${checkpointId}/${filePath}`);
        const currentUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand(
            'vscode.diff',
            checkpointUri,
            currentUri,
            `${path.basename(filePath)} (Checkpoint vs Current)`
        );
    }

    getCheckpointContentProvider(): vscode.TextDocumentContentProvider {
        return {
            provideTextDocumentContent: (uri: vscode.Uri): string => {
                const [checkpointId, ...pathParts] = uri.path.split('/').filter(Boolean);
                const filePath = '/' + pathParts.join('/');
                
                const checkpoint = this.checkpoints.find(c => c.id === checkpointId);
                if (!checkpoint) {
                    return '// Checkpoint not found';
                }

                const file = checkpoint.files.find(f => f.path === filePath || f.path.endsWith(pathParts.join('/')));
                if (!file) {
                    return '// File not found in checkpoint';
                }

                return file.content;
            }
        };
    }

    dispose(): void {
        // Cleanup if needed
    }
}
