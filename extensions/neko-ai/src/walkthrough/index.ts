import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WalkthroughStep {
    id: string;
    title: string;
    description: string;
    media?: {
        markdown?: string;
        image?: string;
    };
    completionEvents?: string[];
}

export interface WalkthroughConfig {
    id: string;
    title: string;
    description: string;
    steps: WalkthroughStep[];
}

export const WALKTHROUGH_CONFIG: WalkthroughConfig = {
    id: 'neko.walkthrough',
    title: 'Getting Started with Neko AI',
    description: 'Learn how to use Neko AI to boost your productivity',
    steps: [
        {
            id: 'welcome',
            title: 'Welcome to Neko AI',
            description: 'Get started with your AI coding assistant',
            media: { markdown: 'step1.md' },
            completionEvents: ['onCommand:neko.openChat']
        },
        {
            id: 'configure',
            title: 'Configure API Provider',
            description: 'Set up your preferred AI provider',
            media: { markdown: 'step2.md' },
            completionEvents: ['onSettingChanged:neko.apiProvider']
        },
        {
            id: 'mentions',
            title: 'Using Context Mentions',
            description: 'Learn how to provide context to the AI',
            media: { markdown: 'step3.md' }
        },
        {
            id: 'modes',
            title: 'Agent Modes',
            description: 'Understand different agent modes',
            media: { markdown: 'step4.md' }
        },
        {
            id: 'tools',
            title: 'Tools and Commands',
            description: 'Explore available tools and commands',
            media: { markdown: 'step5.md' },
            completionEvents: ['onCommand:neko.newTask']
        }
    ]
};

export class WalkthroughProvider {
    private extensionPath: string;
    private completedSteps: Set<string> = new Set();

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

    async initialize(context: vscode.ExtensionContext): Promise<void> {
        const completed = context.globalState.get<string[]>('neko.walkthrough.completed', []);
        this.completedSteps = new Set(completed);
    }

    async markStepCompleted(stepId: string, context: vscode.ExtensionContext): Promise<void> {
        this.completedSteps.add(stepId);
        await context.globalState.update(
            'neko.walkthrough.completed',
            Array.from(this.completedSteps)
        );
    }

    isStepCompleted(stepId: string): boolean {
        return this.completedSteps.has(stepId);
    }

    isWalkthroughCompleted(): boolean {
        return WALKTHROUGH_CONFIG.steps.every(step => this.completedSteps.has(step.id));
    }

    async resetProgress(context: vscode.ExtensionContext): Promise<void> {
        this.completedSteps.clear();
        await context.globalState.update('neko.walkthrough.completed', []);
    }

    getStepContent(stepId: string): string | null {
        const step = WALKTHROUGH_CONFIG.steps.find(s => s.id === stepId);
        if (!step?.media?.markdown) {
            return null;
        }

        const markdownPath = path.join(
            this.extensionPath,
            'src',
            'walkthrough',
            step.media.markdown
        );

        try {
            return fs.readFileSync(markdownPath, 'utf-8');
        } catch {
            return null;
        }
    }

    getProgress(): { completed: number; total: number; percentage: number } {
        const total = WALKTHROUGH_CONFIG.steps.length;
        const completed = this.completedSteps.size;
        return {
            completed,
            total,
            percentage: Math.round((completed / total) * 100)
        };
    }

    async openWalkthrough(): Promise<void> {
        await vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'neko.neko-ai#neko.walkthrough'
        );
    }
}
