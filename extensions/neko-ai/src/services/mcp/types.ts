export type McpTransportType = 'stdio' | 'sse' | 'streamable-http' | 'websocket';

export interface McpServerConfig {
    // stdio transport
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    
    // HTTP/SSE/WebSocket transport
    url?: string;
    headers?: Record<string, string>;
    
    // Transport type (auto-detected if not specified)
    transport?: McpTransportType;
    
    // Common options
    disabled?: boolean;
    autoApprove?: string[];
    alwaysAllow?: string[];
    timeout?: number;
}

export interface McpConfigFile {
    mcpServers: Record<string, McpServerConfig>;
}

export interface ImportSource {
    type: 'claude' | 'cursor' | 'vscode' | 'custom';
    path: string;
    name: string;
}

export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    servers: string[];
}

export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export const KNOWN_CONFIG_PATHS: Record<string, ImportSource[]> = {
    linux: [
        {
            type: 'claude',
            path: '~/.config/claude/claude_desktop_config.json',
            name: 'Claude Desktop'
        },
        {
            type: 'cursor',
            path: '~/.cursor/mcp.json',
            name: 'Cursor'
        },
        {
            type: 'vscode',
            path: '~/.vscode/mcp.json',
            name: 'VS Code'
        }
    ],
    darwin: [
        {
            type: 'claude',
            path: '~/Library/Application Support/Claude/claude_desktop_config.json',
            name: 'Claude Desktop'
        },
        {
            type: 'cursor',
            path: '~/.cursor/mcp.json',
            name: 'Cursor'
        },
        {
            type: 'vscode',
            path: '~/.vscode/mcp.json',
            name: 'VS Code'
        }
    ],
    win32: [
        {
            type: 'claude',
            path: '%APPDATA%/Claude/claude_desktop_config.json',
            name: 'Claude Desktop'
        },
        {
            type: 'cursor',
            path: '%USERPROFILE%/.cursor/mcp.json',
            name: 'Cursor'
        },
        {
            type: 'vscode',
            path: '%USERPROFILE%/.vscode/mcp.json',
            name: 'VS Code'
        }
    ]
};
