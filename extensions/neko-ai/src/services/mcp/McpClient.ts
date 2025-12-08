import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { McpTransportType, McpServerConfig } from './types';

export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export interface McpResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface McpServer {
    name: string;
    config: McpServerConfig;
    transport: McpTransportType;
    tools: McpTool[];
    resources: McpResource[];
    connected: boolean;
    process?: ChildProcess;
    eventSource?: EventSource;
    webSocket?: WebSocket;
    sessionId?: string;
}

export interface McpToolResult {
    content: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: unknown;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
    error?: { code: number; message: string };
}

export class McpClient implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private servers: Map<string, McpServer> = new Map();
    private requestId = 0;
    private pendingRequests: Map<number, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }> = new Map();

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    async loadConfig(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.neko', 'mcp_servers.json');

        try {
            const configData = await vscode.workspace.fs.readFile(configPath);
            const config = JSON.parse(configData.toString());

            if (config.mcpServers) {
                for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
                    const cfg = serverConfig as McpServerConfig;
                    if (!cfg.disabled) {
                        const transport = this.detectTransport(cfg);
                        this.servers.set(name, {
                            name,
                            config: cfg,
                            transport,
                            tools: [],
                            resources: [],
                            connected: false
                        });
                    }
                }
            }
        } catch {
            this.outputChannel.appendLine('No MCP config found or invalid config');
        }
    }

    private detectTransport(config: McpServerConfig): McpTransportType {
        if (config.transport) {
            return config.transport;
        }

        if (config.url) {
            const url = config.url.toLowerCase();
            if (url.startsWith('ws://') || url.startsWith('wss://')) {
                return 'websocket';
            }
            if (url.includes('/sse') || url.includes('events')) {
                return 'sse';
            }
            return 'streamable-http';
        }

        return 'stdio';
    }

    async connectServer(name: string): Promise<boolean> {
        const server = this.servers.get(name);
        if (!server) {
            this.outputChannel.appendLine(`Server not found: ${name}`);
            return false;
        }

        if (server.connected) {
            return true;
        }

        try {
            switch (server.transport) {
                case 'stdio':
                    return await this.connectStdio(server);
                case 'sse':
                    return await this.connectSSE(server);
                case 'streamable-http':
                    return await this.connectStreamableHttp(server);
                case 'websocket':
                    return await this.connectWebSocket(server);
                default:
                    throw new Error(`Unknown transport: ${server.transport}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to connect to ${name}: ${error}`);
            return false;
        }
    }

    private async connectStdio(server: McpServer): Promise<boolean> {
        const { config } = server;
        if (!config.command) {
            throw new Error('Command is required for stdio transport');
        }

        const proc = spawn(config.command, config.args || [], {
            env: { ...process.env, ...config.env },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        server.process = proc;

        proc.stdout?.on('data', (data) => {
            this.handleStdioMessage(server.name, data.toString());
        });

        proc.stderr?.on('data', (data) => {
            this.outputChannel.appendLine(`[${server.name}] stderr: ${data}`);
        });

        proc.on('close', (code) => {
            this.outputChannel.appendLine(`[${server.name}] process exited with code ${code}`);
            server.connected = false;
            server.process = undefined;
        });

        await this.initializeServer(server);
        return true;
    }

    private async connectSSE(server: McpServer): Promise<boolean> {
        const { config } = server;
        if (!config.url) {
            throw new Error('URL is required for SSE transport');
        }

        return new Promise((resolve, reject) => {
            const headers = config.headers || {};
            const eventSource = new EventSource(config.url!, {
                // @ts-expect-error - headers not in standard EventSource
                headers
            });

            server.eventSource = eventSource;

            eventSource.onopen = async () => {
                this.outputChannel.appendLine(`[${server.name}] SSE connected`);
                try {
                    await this.initializeServer(server);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };

            eventSource.onmessage = (event) => {
                this.handleHttpMessage(server.name, event.data);
            };

            eventSource.onerror = (error) => {
                this.outputChannel.appendLine(`[${server.name}] SSE error: ${error}`);
                server.connected = false;
                reject(new Error('SSE connection failed'));
            };

            setTimeout(() => {
                if (!server.connected) {
                    eventSource.close();
                    reject(new Error('SSE connection timeout'));
                }
            }, config.timeout || 30000);
        });
    }

    private async connectStreamableHttp(server: McpServer): Promise<boolean> {
        const { config } = server;
        if (!config.url) {
            throw new Error('URL is required for HTTP transport');
        }

        const initResponse = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'neko-ai', version: '1.0.0' }
                }
            })
        });

        if (!initResponse.ok) {
            throw new Error(`HTTP error: ${initResponse.status}`);
        }

        const sessionId = initResponse.headers.get('mcp-session-id');
        if (sessionId) {
            server.sessionId = sessionId;
        }

        await this.fetchServerCapabilities(server);
        server.connected = true;
        this.outputChannel.appendLine(`Connected to MCP server (HTTP): ${server.name}`);
        return true;
    }

    private async connectWebSocket(server: McpServer): Promise<boolean> {
        const { config } = server;
        if (!config.url) {
            throw new Error('URL is required for WebSocket transport');
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(config.url!);
            server.webSocket = ws;

            ws.onopen = async () => {
                this.outputChannel.appendLine(`[${server.name}] WebSocket connected`);
                try {
                    await this.initializeServer(server);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };

            ws.onmessage = (event) => {
                this.handleHttpMessage(server.name, event.data);
            };

            ws.onerror = (error) => {
                this.outputChannel.appendLine(`[${server.name}] WebSocket error: ${error}`);
                reject(new Error('WebSocket connection failed'));
            };

            ws.onclose = () => {
                server.connected = false;
                server.webSocket = undefined;
            };

            setTimeout(() => {
                if (!server.connected) {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, config.timeout || 30000);
        });
    }

    private async initializeServer(server: McpServer): Promise<void> {
        await this.sendRequest(server.name, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'neko-ai', version: '1.0.0' }
        });

        await this.fetchServerCapabilities(server);
        server.connected = true;
        this.outputChannel.appendLine(`Connected to MCP server: ${server.name}`);
    }

    private async fetchServerCapabilities(server: McpServer): Promise<void> {
        try {
            const toolsResponse = await this.sendRequest(server.name, 'tools/list', {});
            if (toolsResponse && Array.isArray((toolsResponse as { tools: McpTool[] }).tools)) {
                server.tools = (toolsResponse as { tools: McpTool[] }).tools;
            }
        } catch {
            this.outputChannel.appendLine(`[${server.name}] Failed to list tools`);
        }

        try {
            const resourcesResponse = await this.sendRequest(server.name, 'resources/list', {});
            if (resourcesResponse && Array.isArray((resourcesResponse as { resources: McpResource[] }).resources)) {
                server.resources = (resourcesResponse as { resources: McpResource[] }).resources;
            }
        } catch {
            // Resources not supported
        }
    }

    async disconnectServer(name: string): Promise<void> {
        const server = this.servers.get(name);
        if (!server) return;

        if (server.process) {
            server.process.kill();
            server.process = undefined;
        }

        if (server.eventSource) {
            server.eventSource.close();
            server.eventSource = undefined;
        }

        if (server.webSocket) {
            server.webSocket.close();
            server.webSocket = undefined;
        }

        server.connected = false;
    }

    async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<McpToolResult> {
        const server = this.servers.get(serverName);
        if (!server?.connected) {
            throw new Error(`Server not connected: ${serverName}`);
        }

        const response = await this.sendRequest(serverName, 'tools/call', {
            name: toolName,
            arguments: args
        });

        return response as McpToolResult;
    }

    async readResource(serverName: string, uri: string): Promise<McpToolResult> {
        const server = this.servers.get(serverName);
        if (!server?.connected) {
            throw new Error(`Server not connected: ${serverName}`);
        }

        const response = await this.sendRequest(serverName, 'resources/read', { uri });
        return response as McpToolResult;
    }

    private async sendRequest(serverName: string, method: string, params: unknown): Promise<unknown> {
        const server = this.servers.get(serverName);
        if (!server) {
            throw new Error(`Server not found: ${serverName}`);
        }

        const id = ++this.requestId;
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        switch (server.transport) {
            case 'stdio':
                return this.sendStdioRequest(server, request);
            case 'sse':
            case 'streamable-http':
                return this.sendHttpRequest(server, request);
            case 'websocket':
                return this.sendWebSocketRequest(server, request);
            default:
                throw new Error(`Unknown transport: ${server.transport}`);
        }
    }

    private sendStdioRequest(server: McpServer, request: JsonRpcRequest): Promise<unknown> {
        if (!server.process?.stdin) {
            throw new Error(`Server not available: ${server.name}`);
        }

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(request.id, { resolve, reject });
            const message = JSON.stringify(request) + '\n';
            server.process!.stdin!.write(message);

            setTimeout(() => {
                if (this.pendingRequests.has(request.id)) {
                    this.pendingRequests.delete(request.id);
                    reject(new Error('Request timeout'));
                }
            }, server.config.timeout || 30000);
        });
    }

    private async sendHttpRequest(server: McpServer, request: JsonRpcRequest): Promise<unknown> {
        if (!server.config.url) {
            throw new Error('URL not configured');
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...server.config.headers
        };

        if (server.sessionId) {
            headers['mcp-session-id'] = server.sessionId;
        }

        const response = await fetch(server.config.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json() as JsonRpcResponse;
        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.result;
    }

    private sendWebSocketRequest(server: McpServer, request: JsonRpcRequest): Promise<unknown> {
        if (!server.webSocket) {
            throw new Error(`WebSocket not connected: ${server.name}`);
        }

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(request.id, { resolve, reject });
            server.webSocket!.send(JSON.stringify(request));

            setTimeout(() => {
                if (this.pendingRequests.has(request.id)) {
                    this.pendingRequests.delete(request.id);
                    reject(new Error('Request timeout'));
                }
            }, server.config.timeout || 30000);
        });
    }

    private handleStdioMessage(serverName: string, data: string): void {
        const lines = data.split('\n').filter(line => line.trim());
        for (const line of lines) {
            this.handleJsonRpcMessage(serverName, line);
        }
    }

    private handleHttpMessage(serverName: string, data: string): void {
        this.handleJsonRpcMessage(serverName, data);
    }

    private handleJsonRpcMessage(serverName: string, data: string): void {
        try {
            const message = JSON.parse(data) as JsonRpcResponse;

            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject } = this.pendingRequests.get(message.id)!;
                this.pendingRequests.delete(message.id);

                if (message.error) {
                    reject(new Error(message.error.message));
                } else {
                    resolve(message.result);
                }
            }
        } catch {
            // Not JSON, ignore
        }
    }

    getServers(): McpServer[] {
        return Array.from(this.servers.values());
    }

    getServer(name: string): McpServer | undefined {
        return this.servers.get(name);
    }

    getTools(serverName?: string): McpTool[] {
        if (serverName) {
            return this.servers.get(serverName)?.tools || [];
        }

        const allTools: McpTool[] = [];
        for (const server of this.servers.values()) {
            allTools.push(...server.tools);
        }
        return allTools;
    }

    getResources(serverName?: string): McpResource[] {
        if (serverName) {
            return this.servers.get(serverName)?.resources || [];
        }

        const allResources: McpResource[] = [];
        for (const server of this.servers.values()) {
            allResources.push(...server.resources);
        }
        return allResources;
    }

    dispose(): void {
        for (const server of this.servers.values()) {
            this.disconnectServer(server.name);
        }
        this.servers.clear();
    }
}
