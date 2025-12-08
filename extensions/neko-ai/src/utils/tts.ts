import * as vscode from 'vscode';

export interface TTSOptions {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
    language?: string;
}

export interface TTSVoice {
    id: string;
    name: string;
    language: string;
    isDefault: boolean;
}

export class TTSService {
    private enabled: boolean = false;
    private options: TTSOptions;
    private speaking: boolean = false;
    private queue: string[] = [];

    constructor(options: TTSOptions = {}) {
        this.options = {
            rate: options.rate ?? 1.0,
            pitch: options.pitch ?? 1.0,
            volume: options.volume ?? 1.0,
            voice: options.voice,
            language: options.language ?? 'en-US'
        };
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    isSpeaking(): boolean {
        return this.speaking;
    }

    setOptions(options: Partial<TTSOptions>): void {
        this.options = { ...this.options, ...options };
    }

    getOptions(): TTSOptions {
        return { ...this.options };
    }

    async speak(text: string): Promise<void> {
        if (!this.enabled || !text.trim()) {
            return;
        }

        this.queue.push(text);

        if (!this.speaking) {
            await this.processQueue();
        }
    }

    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) {
            this.speaking = false;
            return;
        }

        this.speaking = true;
        const text = this.queue.shift();

        if (text) {
            await this.synthesize(text);
        }

        await this.processQueue();
    }

    private async synthesize(text: string): Promise<void> {
        const cleanText = this.cleanTextForSpeech(text);

        if (!cleanText) {
            return;
        }

        try {
            await vscode.commands.executeCommand('editor.action.speakText', cleanText);
        } catch (error) {
            console.warn('TTS not available:', error);
        }
    }

    private cleanTextForSpeech(text: string): string {
        let cleaned = text;

        cleaned = cleaned.replace(/```[\s\S]*?```/g, 'code block');
        cleaned = cleaned.replace(/`[^`]+`/g, 'inline code');
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        cleaned = cleaned.replace(/#{1,6}\s*/g, '');
        cleaned = cleaned.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
        cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
        cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');
        cleaned = cleaned.replace(/<[^>]+>/g, '');
        cleaned = cleaned.replace(/\n{2,}/g, '. ');
        cleaned = cleaned.replace(/\n/g, ' ');
        cleaned = cleaned.replace(/\s{2,}/g, ' ');

        return cleaned.trim();
    }

    stop(): void {
        this.queue = [];
        this.speaking = false;
    }

    pause(): void {
        this.speaking = false;
    }

    resume(): void {
        if (this.queue.length > 0 && !this.speaking) {
            this.processQueue();
        }
    }

    clearQueue(): void {
        this.queue = [];
    }

    getQueueLength(): number {
        return this.queue.length;
    }
}

let ttsInstance: TTSService | null = null;

export function getTTSService(): TTSService {
    if (!ttsInstance) {
        ttsInstance = new TTSService();
    }
    return ttsInstance;
}

export function disposeTTSService(): void {
    if (ttsInstance) {
        ttsInstance.stop();
        ttsInstance = null;
    }
}
