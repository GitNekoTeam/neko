import { TOOL_NAMES, TOOL_DEFINITIONS, getToolDefinitions, getToolByName, ToolName } from '../../shared/tools';

describe('TOOL_NAMES', () => {
    it('should have all required tools', () => {
        expect(TOOL_NAMES.READ_FILE).toBe('read_file');
        expect(TOOL_NAMES.WRITE_FILE).toBe('write_to_file');
        expect(TOOL_NAMES.REPLACE_IN_FILE).toBe('replace_in_file');
        expect(TOOL_NAMES.APPLY_DIFF).toBe('apply_diff');
        expect(TOOL_NAMES.INSERT_CONTENT).toBe('insert_content');
        expect(TOOL_NAMES.NEW_FILE).toBe('new_file');
        expect(TOOL_NAMES.LIST_FILES).toBe('list_files');
        expect(TOOL_NAMES.SEARCH_FILES).toBe('search_files');
        expect(TOOL_NAMES.EXECUTE_COMMAND).toBe('execute_command');
        expect(TOOL_NAMES.ASK_FOLLOWUP_QUESTION).toBe('ask_followup_question');
        expect(TOOL_NAMES.ATTEMPT_COMPLETION).toBe('attempt_completion');
        expect(TOOL_NAMES.BROWSER_ACTION).toBe('browser_action');
        expect(TOOL_NAMES.USE_MCP_TOOL).toBe('use_mcp_tool');
        expect(TOOL_NAMES.ACCESS_MCP_RESOURCE).toBe('access_mcp_resource');
    });
});

describe('TOOL_DEFINITIONS', () => {
    it('should have definition for each tool', () => {
        const toolNames = Object.values(TOOL_NAMES);
        
        for (const name of toolNames) {
            expect(TOOL_DEFINITIONS[name]).toBeDefined();
            expect(TOOL_DEFINITIONS[name].name).toBe(name);
            expect(TOOL_DEFINITIONS[name].description).toBeTruthy();
            expect(TOOL_DEFINITIONS[name].inputSchema).toBeDefined();
        }
    });

    it('should have valid input schema for read_file', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.READ_FILE];
        
        expect(def.inputSchema.type).toBe('object');
        expect(def.inputSchema.properties.path).toBeDefined();
        expect(def.inputSchema.required).toContain('path');
    });

    it('should have valid input schema for write_to_file', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.WRITE_FILE];
        
        expect(def.inputSchema.properties.path).toBeDefined();
        expect(def.inputSchema.properties.content).toBeDefined();
        expect(def.inputSchema.required).toContain('path');
        expect(def.inputSchema.required).toContain('content');
    });

    it('should have valid input schema for apply_diff', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.APPLY_DIFF];
        
        expect(def.inputSchema.properties.path).toBeDefined();
        expect(def.inputSchema.properties.diff).toBeDefined();
        expect(def.inputSchema.required).toContain('path');
        expect(def.inputSchema.required).toContain('diff');
    });

    it('should have valid input schema for insert_content', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.INSERT_CONTENT];
        
        expect(def.inputSchema.properties.path).toBeDefined();
        expect(def.inputSchema.properties.position).toBeDefined();
        expect(def.inputSchema.properties.content).toBeDefined();
        expect(def.inputSchema.required).toContain('path');
        expect(def.inputSchema.required).toContain('position');
        expect(def.inputSchema.required).toContain('content');
    });

    it('should have valid input schema for execute_command', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.EXECUTE_COMMAND];
        
        expect(def.inputSchema.properties.command).toBeDefined();
        expect(def.inputSchema.required).toContain('command');
    });

    it('should have valid input schema for browser_action', () => {
        const def = TOOL_DEFINITIONS[TOOL_NAMES.BROWSER_ACTION];
        
        expect(def.inputSchema.properties.action).toBeDefined();
        expect(def.inputSchema.required).toContain('action');
    });
});

describe('getToolDefinitions', () => {
    it('should return all tools when no filter', () => {
        const tools = getToolDefinitions();
        
        expect(tools.length).toBe(Object.keys(TOOL_NAMES).length);
    });

    it('should return filtered tools', () => {
        const tools = getToolDefinitions([TOOL_NAMES.READ_FILE, TOOL_NAMES.WRITE_FILE]);
        
        expect(tools).toHaveLength(2);
        expect(tools.map(t => t.name)).toContain('read_file');
        expect(tools.map(t => t.name)).toContain('write_to_file');
    });

    it('should filter out invalid tool names', () => {
        const tools = getToolDefinitions(['read_file', 'invalid_tool'] as ToolName[]);
        
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('read_file');
    });
});

describe('getToolByName', () => {
    it('should return tool definition by name', () => {
        const tool = getToolByName('read_file');
        
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('read_file');
    });

    it('should return undefined for invalid name', () => {
        const tool = getToolByName('invalid_tool');
        
        expect(tool).toBeUndefined();
    });
});
