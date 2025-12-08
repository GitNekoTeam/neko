import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
    McpServerConfig,
    McpConfigFile,
    ImportSource,
    ImportResult,
    ConfigValidationResult,
    KNOWN_CONFIG_PATHS
} from './types';

export class McpConfigManager {
    private configPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.configPath = this.getDefaultConfigPath();
    }

    private getDefaultConfigPath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return path.join(workspaceFolders[0].uri.fsPath, '.neko', 'mcp_servers.json');
        }
        return path.join(os.homedir(), '.neko', 'mcp_servers.json');
    }

    public async loadConfig(): Promise<McpConfigFile> {
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return { mcpServers: {} };
        }
    }

    public async saveConfig(config: McpConfigFile): Promise<void> {
        const formatted = this.formatConfig(config);
        await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        await fs.writeFile(this.configPath, formatted, 'utf-8');
    }

    public formatConfig(config: McpConfigFile): string {
        const sortedServers: Record<string, McpServerConfig> = {};
        const keys = Object.keys(config.mcpServers).sort();
        
        for (const key of keys) {
            const server = config.mcpServers[key];
            sortedServers[key] = this.formatServerConfig(server);
        }

        return JSON.stringify({ mcpServers: sortedServers }, null, 2);
    }

    private formatServerConfig(server: McpServerConfig): McpServerConfig {
        const formatted: McpServerConfig = {
            command: server.command
        };

        if (server.args && server.args.length > 0) {
            formatted.args = server.args;
        }

        if (server.env && Object.keys(server.env).length > 0) {
            const sortedEnv: Record<string, string> = {};
            for (const key of Object.keys(server.env).sort()) {
                sortedEnv[key] = server.env[key];
            }
            formatted.env = sortedEnv;
        }

        if (server.disabled !== undefined) {
            formatted.disabled = server.disabled;
        }

        if (server.autoApprove && server.autoApprove.length > 0) {
            formatted.autoApprove = server.autoApprove.sort();
        }

        if (server.alwaysAllow && server.alwaysAllow.length > 0) {
            formatted.alwaysAllow = server.alwaysAllow.sort();
        }

        if (server.timeout !== undefined) {
            formatted.timeout = server.timeout;
        }

        return formatted;
    }

    public getAvailableImportSources(): ImportSource[] {
        const platform = process.platform as 'linux' | 'darwin' | 'win32';
        return KNOWN_CONFIG_PATHS[platform] || KNOWN_CONFIG_PATHS.linux;
    }

    public async detectImportSources(): Promise<ImportSource[]> {
        const sources = this.getAvailableImportSources();
        const available: ImportSource[] = [];

        for (const source of sources) {
            const resolvedPath = this.resolvePath(source.path);
            if (await this.fileExists(resolvedPath)) {
                available.push({
                    ...source,
                    path: resolvedPath
                });
            }
        }

        return available;
    }

    public async importFromSource(source: ImportSource, options?: {
        overwrite?: boolean;
        filter?: string[];
    }): Promise<ImportResult> {
        const result: ImportResult = {
            success: false,
            imported: 0,
            skipped: 0,
            errors: [],
            servers: []
        };

        try {
            const resolvedPath = this.resolvePath(source.path);
            const content = await fs.readFile(resolvedPath, 'utf-8');
            const sourceConfig = this.parseSourceConfig(content, source.type);

            if (!sourceConfig || Object.keys(sourceConfig).length === 0) {
                result.errors.push('No MCP servers found in source file');
                return result;
            }

            const currentConfig = await this.loadConfig();
            const overwrite = options?.overwrite ?? false;
            const filter = options?.filter;

            for (const [name, server] of Object.entries(sourceConfig)) {
                if (filter && !filter.includes(name)) {
                    continue;
                }

                if (currentConfig.mcpServers[name] && !overwrite) {
                    result.skipped++;
                    continue;
                }

                currentConfig.mcpServers[name] = this.normalizeServerConfig(server);
                result.imported++;
                result.servers.push(name);
            }

            await this.saveConfig(currentConfig);
            result.success = true;
        } catch (error) {
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        return result;
    }

    public async importFromFile(filePath: string, options?: {
        overwrite?: boolean;
        filter?: string[];
    }): Promise<ImportResult> {
        return this.importFromSource({
            type: 'custom',
            path: filePath,
            name: 'Custom File'
        }, options);
    }

    public async importFromClipboard(options?: {
        overwrite?: boolean;
    }): Promise<ImportResult> {
        const clipboardContent = await vscode.env.clipboard.readText();
        return this.importFromText(clipboardContent, options);
    }

    public async importFromText(text: string, options?: {
        overwrite?: boolean;
    }): Promise<ImportResult> {
        const result: ImportResult = {
            success: false,
            imported: 0,
            skipped: 0,
            errors: [],
            servers: []
        };

        if (!text.trim()) {
            result.errors.push('Input is empty');
            return result;
        }

        try {
            const parsed = JSON.parse(text);
            let servers: Record<string, McpServerConfig>;

            if (parsed.mcpServers) {
                servers = parsed.mcpServers;
            } else if (typeof parsed === 'object' && parsed.command) {
                servers = { imported: parsed };
            } else if (typeof parsed === 'object') {
                servers = parsed;
            } else {
                result.errors.push('Invalid MCP configuration format');
                return result;
            }

            const currentConfig = await this.loadConfig();
            const overwrite = options?.overwrite ?? false;

            for (const [name, server] of Object.entries(servers)) {
                if (!this.isValidServerConfig(server)) {
                    result.errors.push(`Invalid config for server: ${name}`);
                    continue;
                }

                if (currentConfig.mcpServers[name] && !overwrite) {
                    result.skipped++;
                    continue;
                }

                currentConfig.mcpServers[name] = this.normalizeServerConfig(server);
                result.imported++;
                result.servers.push(name);
            }

            if (result.imported > 0) {
                await this.saveConfig(currentConfig);
                result.success = true;
            }
        } catch (error) {
            result.errors.push(error instanceof Error ? error.message : 'Invalid JSON format');
        }

        return result;
    }

    public async showPasteImportDialog(): Promise<ImportResult | undefined> {
        const inputBox = vscode.window.createInputBox();
        inputBox.title = 'Import MCP Server Configuration';
        inputBox.prompt = 'Paste your MCP server JSON configuration';
        inputBox.placeholder = '{"mcpServers": {"server-name": {"command": "..."}}}';
        inputBox.ignoreFocusOut = true;

        return new Promise((resolve) => {
            inputBox.onDidAccept(async () => {
                const text = inputBox.value.trim();
                inputBox.hide();

                if (!text) {
                    resolve(undefined);
                    return;
                }

                const result = await this.importFromText(text);
                this.showImportResult(result);
                resolve(result);
            });

            inputBox.onDidHide(() => {
                inputBox.dispose();
                resolve(undefined);
            });

            inputBox.show();
        });
    }

    public async showMultilinePasteDialog(): Promise<ImportResult | undefined> {
        const doc = await vscode.workspace.openTextDocument({
            language: 'json',
            content: `// Paste your MCP server configuration below and save (Ctrl+S)
// Supported formats:
// 1. Full config: {"mcpServers": {"name": {"command": "..."}}}
// 2. Servers only: {"server-name": {"command": "..."}}
// 3. Single server: {"command": "...", "args": [...]}

`
        });

        await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active
        });

        return new Promise((resolve) => {
            const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
                if (savedDoc.uri.toString() === doc.uri.toString()) {
                    disposable.dispose();

                    let content = savedDoc.getText();
                    content = content.replace(/\/\/.*$/gm, '').trim();

                    if (!content) {
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        resolve(undefined);
                        return;
                    }

                    const result = await this.importFromText(content);
                    this.showImportResult(result);

                    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                    resolve(result);
                }
            });

            const closeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
                const stillOpen = editors.some(e => e.document.uri.toString() === doc.uri.toString());
                if (!stillOpen) {
                    disposable.dispose();
                    closeDisposable.dispose();
                    resolve(undefined);
                }
            });
        });
    }

    private parseSourceConfig(content: string, type: ImportSource['type']): Record<string, McpServerConfig> | null {
        try {
            const parsed = JSON.parse(content);

            switch (type) {
                case 'claude':
                    return parsed.mcpServers || null;
                case 'cursor':
                case 'vscode':
                case 'custom':
                    if (parsed.mcpServers) {
                        return parsed.mcpServers;
                    }
                    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                        const hasServerConfig = Object.values(parsed).some(
                            (v: unknown) => typeof v === 'object' && v !== null && 'command' in v
                        );
                        if (hasServerConfig) {
                            return parsed as Record<string, McpServerConfig>;
                        }
                    }
                    return null;
                default:
                    return parsed.mcpServers || null;
            }
        } catch {
            return null;
        }
    }

    private normalizeServerConfig(server: McpServerConfig): McpServerConfig {
        return {
            command: server.command,
            args: server.args || [],
            env: server.env || {},
            disabled: server.disabled ?? false,
            autoApprove: server.autoApprove || [],
            alwaysAllow: server.alwaysAllow || [],
            timeout: server.timeout
        };
    }

    private isValidServerConfig(config: unknown): config is McpServerConfig {
        if (typeof config !== 'object' || config === null) return false;
        const c = config as Record<string, unknown>;
        return typeof c.command === 'string' && c.command.length > 0;
    }

    public validateConfig(config: McpConfigFile): ConfigValidationResult {
        const result: ConfigValidationResult = {
            valid: true,
            errors: [],
            warnings: []
        };

        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
            result.valid = false;
            result.errors.push('Missing or invalid mcpServers object');
            return result;
        }

        for (const [name, server] of Object.entries(config.mcpServers)) {
            if (!server.command) {
                result.valid = false;
                result.errors.push(`Server "${name}": missing command`);
            }

            if (server.args && !Array.isArray(server.args)) {
                result.warnings.push(`Server "${name}": args should be an array`);
            }

            if (server.env && typeof server.env !== 'object') {
                result.warnings.push(`Server "${name}": env should be an object`);
            }
        }

        return result;
    }

    private resolvePath(inputPath: string): string {
        let resolved = inputPath;

        if (resolved.startsWith('~')) {
            resolved = path.join(os.homedir(), resolved.slice(1));
        }

        if (process.platform === 'win32') {
            resolved = resolved.replace(/%([^%]+)%/g, (_, key) => process.env[key] || '');
        }

        return resolved;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    public async showImportDialog(): Promise<void> {
        const sources = await this.detectImportSources();
        
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(edit) Paste configuration...',
                description: 'Open editor to paste multi-line JSON'
            },
            {
                label: '$(clippy) Import from clipboard',
                description: 'Import from current clipboard content'
            },
            {
                label: '$(file) Import from file...',
                description: 'Select a JSON file to import'
            }
        ];

        for (const source of sources) {
            items.push({
                label: `$(cloud-download) ${source.name}`,
                description: source.path,
                detail: `Import from ${source.type}`
            });
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select import source',
            title: 'Import MCP Servers'
        });

        if (!selected) return;

        let result: ImportResult | undefined;

        if (selected.label.includes('Paste configuration')) {
            result = await this.showMultilinePasteDialog();
        } else if (selected.label.includes('from file')) {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                title: 'Select MCP Configuration File'
            });

            if (!files || files.length === 0) return;
            result = await this.importFromFile(files[0].fsPath);
        } else if (selected.label.includes('clipboard')) {
            result = await this.importFromClipboard();
        } else {
            const source = sources.find(s => selected.label.includes(s.name));
            if (!source) return;
            result = await this.importFromSource(source);
        }

        if (result) {
            this.showImportResult(result);
        }
    }

    private showImportResult(result: ImportResult): void {
        if (result.success && result.imported > 0) {
            vscode.window.showInformationMessage(
                `Imported ${result.imported} MCP server(s): ${result.servers.join(', ')}`
            );
        } else if (result.skipped > 0 && result.imported === 0) {
            vscode.window.showWarningMessage(
                `Skipped ${result.skipped} server(s) (already exist). Use overwrite option to replace.`
            );
        } else if (result.errors.length > 0) {
            vscode.window.showErrorMessage(
                `Import failed: ${result.errors.join(', ')}`
            );
        } else {
            vscode.window.showWarningMessage('No servers were imported');
        }
    }

    public getConfigPath(): string {
        return this.configPath;
    }

    public setConfigPath(newPath: string): void {
        this.configPath = newPath;
    }
}
