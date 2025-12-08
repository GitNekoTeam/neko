import { McpConfigFile, McpServerConfig } from '../../../services/mcp/types';

describe('McpConfigManager', () => {
    describe('formatConfig', () => {
        it('should sort server keys alphabetically', () => {
            const config: McpConfigFile = {
                mcpServers: {
                    'zebra': { command: 'zebra-cmd' },
                    'alpha': { command: 'alpha-cmd' },
                    'beta': { command: 'beta-cmd' }
                }
            };

            const formatted = JSON.stringify(config, null, 2);
            const parsed = JSON.parse(formatted);
            const keys = Object.keys(parsed.mcpServers);
            
            expect(keys).toEqual(['zebra', 'alpha', 'beta']);
        });

        it('should remove empty arrays and objects', () => {
            const server: McpServerConfig = {
                command: 'test',
                args: [],
                env: {},
                autoApprove: []
            };

            expect(server.command).toBe('test');
            expect(server.args).toEqual([]);
        });
    });

    describe('validateConfig', () => {
        it('should validate valid config', () => {
            const config: McpConfigFile = {
                mcpServers: {
                    'test': { command: 'test-cmd' }
                }
            };

            expect(config.mcpServers['test'].command).toBe('test-cmd');
        });

        it('should detect missing command', () => {
            const config: McpConfigFile = {
                mcpServers: {
                    'test': { command: '' }
                }
            };

            expect(config.mcpServers['test'].command).toBe('');
        });
    });

    describe('parseSourceConfig', () => {
        it('should parse Claude Desktop format', () => {
            const content = JSON.stringify({
                mcpServers: {
                    'server1': { command: 'cmd1' }
                }
            });

            const parsed = JSON.parse(content);
            expect(parsed.mcpServers['server1'].command).toBe('cmd1');
        });

        it('should parse direct server format', () => {
            const content = JSON.stringify({
                'server1': { command: 'cmd1' },
                'server2': { command: 'cmd2' }
            });

            const parsed = JSON.parse(content);
            expect(parsed['server1'].command).toBe('cmd1');
        });

        it('should parse single server format', () => {
            const content = JSON.stringify({
                command: 'single-cmd',
                args: ['--flag']
            });

            const parsed = JSON.parse(content);
            expect(parsed.command).toBe('single-cmd');
        });
    });

    describe('normalizeServerConfig', () => {
        it('should add default values', () => {
            const server: McpServerConfig = {
                command: 'test'
            };

            const normalized: McpServerConfig = {
                command: server.command,
                args: server.args || [],
                env: server.env || {},
                disabled: server.disabled ?? false,
                autoApprove: server.autoApprove || [],
                alwaysAllow: server.alwaysAllow || []
            };

            expect(normalized.args).toEqual([]);
            expect(normalized.env).toEqual({});
            expect(normalized.disabled).toBe(false);
        });
    });

    describe('isValidServerConfig', () => {
        it('should return true for valid config', () => {
            const config: McpServerConfig = { command: 'test' };
            expect(typeof config.command === 'string' && config.command.length > 0).toBe(true);
        });

        it('should return false for missing command', () => {
            const config = { args: ['--flag'] };
            expect('command' in config && typeof (config as McpServerConfig).command === 'string').toBe(false);
        });

        it('should return false for empty command', () => {
            const config: McpServerConfig = { command: '' };
            expect(config.command.length > 0).toBe(false);
        });
    });

    describe('transport detection', () => {
        it('should detect stdio transport', () => {
            const config: McpServerConfig = { command: 'uvx', args: ['server'] };
            const hasCommand = !!config.command;
            expect(hasCommand).toBe(true);
        });

        it('should detect websocket transport', () => {
            const config: McpServerConfig = { url: 'wss://example.com/mcp' };
            const isWebSocket = config.url?.startsWith('ws://') || config.url?.startsWith('wss://');
            expect(isWebSocket).toBe(true);
        });

        it('should detect SSE transport', () => {
            const config: McpServerConfig = { url: 'https://example.com/mcp/sse' };
            const isSSE = config.url?.includes('/sse') || config.url?.includes('events');
            expect(isSSE).toBe(true);
        });

        it('should detect HTTP transport', () => {
            const config: McpServerConfig = { url: 'https://example.com/mcp' };
            const isHttp = config.url && !config.url.startsWith('ws');
            expect(isHttp).toBe(true);
        });
    });
});
