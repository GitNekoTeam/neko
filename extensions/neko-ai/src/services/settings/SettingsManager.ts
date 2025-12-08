import * as vscode from 'vscode';

export interface NekoSettings {
    provider: string;
    apiKey: string;
    apiEndpoint: string;
    model: string;
    completionModel: string;
    enableInlineCompletion: boolean;
    enableCodebaseIndexing: boolean;
    embeddingModel: string;
    commandTimeout: number;
    browserDebugPort: number;
    maxContextTokens: number;
    temperature: number;
    locale: string;
    customInstructions: string;
    autoSaveCheckpoints: boolean;
    maxCheckpoints: number;
}

const DEFAULT_SETTINGS: NekoSettings = {
    provider: 'openai',
    apiKey: '',
    apiEndpoint: '',
    model: 'gpt-4',
    completionModel: 'gpt-3.5-turbo',
    enableInlineCompletion: true,
    enableCodebaseIndexing: true,
    embeddingModel: 'text-embedding-3-small',
    commandTimeout: 120,
    browserDebugPort: 9222,
    maxContextTokens: 8000,
    temperature: 0.7,
    locale: 'en',
    customInstructions: '',
    autoSaveCheckpoints: true,
    maxCheckpoints: 50
};

export class SettingsManager implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];
    private settingsChangeEmitter = new vscode.EventEmitter<Partial<NekoSettings>>();

    readonly onSettingsChanged = this.settingsChangeEmitter.event;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.setupConfigListener();
    }

    private setupConfigListener(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('neko-ai')) {
                    const changes = this.getChangedSettings(event);
                    if (Object.keys(changes).length > 0) {
                        this.settingsChangeEmitter.fire(changes);
                        this.outputChannel.appendLine(`Settings changed: ${Object.keys(changes).join(', ')}`);
                    }
                }
            })
        );
    }

    private getChangedSettings(event: vscode.ConfigurationChangeEvent): Partial<NekoSettings> {
        const changes: Partial<NekoSettings> = {};
        const keys: (keyof NekoSettings)[] = [
            'provider', 'apiKey', 'apiEndpoint', 'model', 'completionModel',
            'enableInlineCompletion', 'enableCodebaseIndexing', 'embeddingModel',
            'commandTimeout', 'browserDebugPort', 'maxContextTokens', 'temperature',
            'locale', 'customInstructions', 'autoSaveCheckpoints', 'maxCheckpoints'
        ];

        for (const key of keys) {
            if (event.affectsConfiguration(`neko-ai.${key}`)) {
                (changes as Record<string, unknown>)[key] = this.get(key);
            }
        }

        return changes;
    }

    get<K extends keyof NekoSettings>(key: K): NekoSettings[K] {
        const config = vscode.workspace.getConfiguration('neko-ai');
        return config.get<NekoSettings[K]>(key) ?? DEFAULT_SETTINGS[key];
    }

    async set<K extends keyof NekoSettings>(
        key: K,
        value: NekoSettings[K],
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('neko-ai');
        await config.update(key, value, target);
    }

    getAll(): NekoSettings {
        return {
            provider: this.get('provider'),
            apiKey: this.get('apiKey'),
            apiEndpoint: this.get('apiEndpoint'),
            model: this.get('model'),
            completionModel: this.get('completionModel'),
            enableInlineCompletion: this.get('enableInlineCompletion'),
            enableCodebaseIndexing: this.get('enableCodebaseIndexing'),
            embeddingModel: this.get('embeddingModel'),
            commandTimeout: this.get('commandTimeout'),
            browserDebugPort: this.get('browserDebugPort'),
            maxContextTokens: this.get('maxContextTokens'),
            temperature: this.get('temperature'),
            locale: this.get('locale'),
            customInstructions: this.get('customInstructions'),
            autoSaveCheckpoints: this.get('autoSaveCheckpoints'),
            maxCheckpoints: this.get('maxCheckpoints')
        };
    }

    async setAll(settings: Partial<NekoSettings>): Promise<void> {
        for (const [key, value] of Object.entries(settings)) {
            await this.set(key as keyof NekoSettings, value as NekoSettings[keyof NekoSettings]);
        }
    }

    async resetToDefaults(): Promise<void> {
        await this.setAll(DEFAULT_SETTINGS);
    }

    isApiKeyConfigured(): boolean {
        const apiKey = this.get('apiKey');
        return apiKey.length > 0;
    }

    getProviderConfig(): { provider: string; apiKey: string; apiEndpoint: string; model: string } {
        return {
            provider: this.get('provider'),
            apiKey: this.get('apiKey'),
            apiEndpoint: this.get('apiEndpoint'),
            model: this.get('model')
        };
    }

    async promptForApiKey(): Promise<string | undefined> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your API key',
            password: true,
            placeHolder: 'sk-...',
            ignoreFocusOut: true
        });

        if (apiKey) {
            await this.set('apiKey', apiKey);
        }

        return apiKey;
    }

    async selectProvider(): Promise<string | undefined> {
        const providers = [
            { label: 'OpenAI', value: 'openai', description: 'GPT-4, GPT-3.5' },
            { label: 'Anthropic', value: 'anthropic', description: 'Claude 3' },
            { label: 'Google Gemini', value: 'gemini', description: 'Gemini Pro' },
            { label: 'Azure OpenAI', value: 'azure', description: 'Azure-hosted OpenAI' },
            { label: 'Ollama', value: 'ollama', description: 'Local models' },
            { label: 'OpenRouter', value: 'openrouter', description: 'Multiple providers' },
            { label: 'DeepSeek', value: 'deepseek', description: 'DeepSeek models' },
            { label: 'Custom', value: 'custom', description: 'Custom API endpoint' }
        ];

        const selected = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select AI provider',
            matchOnDescription: true
        });

        if (selected) {
            await this.set('provider', selected.value);
            return selected.value;
        }

        return undefined;
    }

    async selectModel(): Promise<string | undefined> {
        const provider = this.get('provider');
        let models: { label: string; value: string }[] = [];

        switch (provider) {
            case 'openai':
                models = [
                    { label: 'GPT-4o', value: 'gpt-4o' },
                    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                    { label: 'GPT-4', value: 'gpt-4' },
                    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
                ];
                break;
            case 'anthropic':
                models = [
                    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
                    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
                    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
                    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
                ];
                break;
            case 'gemini':
                models = [
                    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
                    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
                    { label: 'Gemini Pro', value: 'gemini-pro' }
                ];
                break;
            case 'deepseek':
                models = [
                    { label: 'DeepSeek Chat', value: 'deepseek-chat' },
                    { label: 'DeepSeek Coder', value: 'deepseek-coder' }
                ];
                break;
            default: {
                const customModel = await vscode.window.showInputBox({
                    prompt: 'Enter model name',
                    placeHolder: 'model-name'
                });
                if (customModel) {
                    await this.set('model', customModel);
                }
                return customModel;
            }
        }

        const selected = await vscode.window.showQuickPick(models, {
            placeHolder: 'Select model'
        });

        if (selected) {
            await this.set('model', selected.value);
            return selected.value;
        }

        return undefined;
    }

    dispose(): void {
        this.settingsChangeEmitter.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
