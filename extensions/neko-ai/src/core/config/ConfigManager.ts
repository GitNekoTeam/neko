import * as vscode from 'vscode';
import * as path from 'path';

export interface NekoConfig {
    provider: string;
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    completionModel?: string;
    embeddingModel?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    locale?: string;
    theme?: string;
    autoSave?: boolean;
    enableCompletion?: boolean;
    enableIndexing?: boolean;
    enableBrowser?: boolean;
    debugPort?: number;
    experimental?: boolean;
}

export interface ProviderConfig {
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    completionModel?: string;
    embeddingModel?: string;
    options?: Record<string, unknown>;
}

export class ConfigManager {
    private context: vscode.ExtensionContext;
    private configSection = 'neko-ai';
    private workspaceConfigFile = '.neko/config.json';
    private cachedConfig: NekoConfig | null = null;
    private onConfigChangeCallbacks: ((config: NekoConfig) => void)[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.setupConfigWatcher();
    }

    private setupConfigWatcher(): void {
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(this.configSection)) {
                this.cachedConfig = null;
                const config = this.getConfig();
                this.notifyConfigChange(config);
            }
        });
    }

    getConfig(): NekoConfig {
        if (this.cachedConfig) {
            return this.cachedConfig;
        }

        const vsConfig = vscode.workspace.getConfiguration(this.configSection);
        
        this.cachedConfig = {
            provider: vsConfig.get<string>('provider') || 'openai',
            apiKey: vsConfig.get<string>('apiKey'),
            apiEndpoint: vsConfig.get<string>('apiEndpoint'),
            model: vsConfig.get<string>('model'),
            completionModel: vsConfig.get<string>('completionModel'),
            embeddingModel: vsConfig.get<string>('embeddingModel'),
            temperature: vsConfig.get<number>('temperature') ?? 0.7,
            maxTokens: vsConfig.get<number>('maxTokens') ?? 4096,
            timeout: vsConfig.get<number>('timeout') ?? 120,
            locale: vsConfig.get<string>('locale'),
            theme: vsConfig.get<string>('theme') ?? 'auto',
            autoSave: vsConfig.get<boolean>('autoSave') ?? true,
            enableCompletion: vsConfig.get<boolean>('enableCompletion') ?? true,
            enableIndexing: vsConfig.get<boolean>('enableIndexing') ?? false,
            enableBrowser: vsConfig.get<boolean>('enableBrowser') ?? false,
            debugPort: vsConfig.get<number>('debugPort') ?? 9222,
            experimental: vsConfig.get<boolean>('experimental') ?? false
        };

        return this.cachedConfig;
    }

    async setConfig<K extends keyof NekoConfig>(key: K, value: NekoConfig[K], global: boolean = true): Promise<void> {
        const vsConfig = vscode.workspace.getConfiguration(this.configSection);
        await vsConfig.update(key, value, global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace);
        this.cachedConfig = null;
    }

    getProviderConfig(provider: string): ProviderConfig {
        const vsConfig = vscode.workspace.getConfiguration(this.configSection);
        const providers = vsConfig.get<Record<string, ProviderConfig>>('providers') || {};
        return providers[provider] || {};
    }

    async setProviderConfig(provider: string, config: ProviderConfig): Promise<void> {
        const vsConfig = vscode.workspace.getConfiguration(this.configSection);
        const providers = vsConfig.get<Record<string, ProviderConfig>>('providers') || {};
        providers[provider] = { ...providers[provider], ...config };
        await vsConfig.update('providers', providers, vscode.ConfigurationTarget.Global);
    }

    async loadWorkspaceConfig(): Promise<Partial<NekoConfig> | null> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return null;

        try {
            const configPath = path.join(workspaceRoot, this.workspaceConfigFile);
            const uri = vscode.Uri.file(configPath);
            const content = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(Buffer.from(content).toString('utf-8'));
        } catch {
            return null;
        }
    }

    async saveWorkspaceConfig(config: Partial<NekoConfig>): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const configDir = path.join(workspaceRoot, '.neko');
        const configPath = path.join(configDir, 'config.json');

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(configDir));
        } catch {
            // Directory may exist
        }

        const content = JSON.stringify(config, null, 2);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(configPath),
            Buffer.from(content, 'utf-8')
        );
    }

    async getMergedConfig(): Promise<NekoConfig> {
        const baseConfig = this.getConfig();
        const workspaceConfig = await this.loadWorkspaceConfig();

        if (workspaceConfig) {
            return { ...baseConfig, ...workspaceConfig };
        }

        return baseConfig;
    }

    async getSecretKey(key: string): Promise<string | undefined> {
        return this.context.secrets.get(key);
    }

    async setSecretKey(key: string, value: string): Promise<void> {
        await this.context.secrets.store(key, value);
    }

    async deleteSecretKey(key: string): Promise<void> {
        await this.context.secrets.delete(key);
    }

    async getApiKey(provider: string): Promise<string | undefined> {
        const secretKey = await this.context.secrets.get(`${provider}-api-key`);
        if (secretKey) return secretKey;

        const providerConfig = this.getProviderConfig(provider);
        if (providerConfig.apiKey) return providerConfig.apiKey;

        const config = this.getConfig();
        if (config.provider === provider && config.apiKey) return config.apiKey;

        return undefined;
    }

    async setApiKey(provider: string, apiKey: string): Promise<void> {
        await this.context.secrets.store(`${provider}-api-key`, apiKey);
    }

    onConfigChange(callback: (config: NekoConfig) => void): vscode.Disposable {
        this.onConfigChangeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const index = this.onConfigChangeCallbacks.indexOf(callback);
            if (index >= 0) this.onConfigChangeCallbacks.splice(index, 1);
        });
    }

    private notifyConfigChange(config: NekoConfig): void {
        for (const callback of this.onConfigChangeCallbacks) {
            try {
                callback(config);
            } catch {
                // Ignore callback errors
            }
        }
    }

    validateConfig(): { valid: boolean; errors: string[] } {
        const config = this.getConfig();
        const errors: string[] = [];

        if (!config.provider) {
            errors.push('Provider is required');
        }

        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
            errors.push('Temperature must be between 0 and 2');
        }

        if (config.maxTokens !== undefined && config.maxTokens < 1) {
            errors.push('Max tokens must be at least 1');
        }

        if (config.timeout !== undefined && config.timeout < 1) {
            errors.push('Timeout must be at least 1 second');
        }

        return { valid: errors.length === 0, errors };
    }

    resetToDefaults(): void {
        this.cachedConfig = null;
    }
}
