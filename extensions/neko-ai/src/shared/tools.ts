import { ToolDefinition } from './api';

export const TOOL_NAMES = {
    READ_FILE: 'read_file',
    WRITE_FILE: 'write_to_file',
    REPLACE_IN_FILE: 'replace_in_file',
    APPLY_DIFF: 'apply_diff',
    INSERT_CONTENT: 'insert_content',
    NEW_FILE: 'new_file',
    LIST_FILES: 'list_files',
    LIST_CODE_DEFINITION_NAMES: 'list_code_definition_names',
    SEARCH_FILES: 'search_files',
    EXECUTE_COMMAND: 'execute_command',
    ASK_FOLLOWUP_QUESTION: 'ask_followup_question',
    ATTEMPT_COMPLETION: 'attempt_completion',
    BROWSER_ACTION: 'browser_action',
    USE_MCP_TOOL: 'use_mcp_tool',
    ACCESS_MCP_RESOURCE: 'access_mcp_resource'
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];

export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
    [TOOL_NAMES.READ_FILE]: {
        name: TOOL_NAMES.READ_FILE,
        description: 'Read the contents of a file at the specified path.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to read (relative to workspace root)'
                }
            },
            required: ['path']
        }
    },
    [TOOL_NAMES.WRITE_FILE]: {
        name: TOOL_NAMES.WRITE_FILE,
        description: 'Write content to a file at the specified path. Creates the file if it does not exist.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to write (relative to workspace root)'
                },
                content: {
                    type: 'string',
                    description: 'The content to write to the file'
                }
            },
            required: ['path', 'content']
        }
    },
    [TOOL_NAMES.REPLACE_IN_FILE]: {
        name: TOOL_NAMES.REPLACE_IN_FILE,
        description: 'Replace specific content in a file using search and replace.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to modify'
                },
                diff: {
                    type: 'string',
                    description: 'The diff content with SEARCH and REPLACE blocks'
                }
            },
            required: ['path', 'diff']
        }
    },
    [TOOL_NAMES.APPLY_DIFF]: {
        name: TOOL_NAMES.APPLY_DIFF,
        description: 'Apply a diff to a file using SEARCH/REPLACE blocks. Supports multiple changes and fuzzy matching.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to modify'
                },
                diff: {
                    type: 'string',
                    description: 'The diff with <<<<<<< SEARCH / ======= / >>>>>>> REPLACE blocks'
                }
            },
            required: ['path', 'diff']
        }
    },
    [TOOL_NAMES.INSERT_CONTENT]: {
        name: TOOL_NAMES.INSERT_CONTENT,
        description: 'Insert content at a specific position in a file (start, end, or line number).',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to modify'
                },
                position: {
                    type: 'string',
                    enum: ['start', 'end', 'line'],
                    description: 'Where to insert: start, end, or at specific line'
                },
                content: {
                    type: 'string',
                    description: 'The content to insert'
                },
                line: {
                    type: 'number',
                    description: 'Line number (required when position is "line")'
                }
            },
            required: ['path', 'position', 'content']
        }
    },
    [TOOL_NAMES.NEW_FILE]: {
        name: TOOL_NAMES.NEW_FILE,
        description: 'Create a new file with optional content. Creates parent directories if needed.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to create'
                },
                content: {
                    type: 'string',
                    description: 'Initial content for the file'
                },
                overwrite: {
                    type: 'boolean',
                    description: 'Overwrite if file exists'
                }
            },
            required: ['path']
        }
    },
    [TOOL_NAMES.LIST_FILES]: {
        name: TOOL_NAMES.LIST_FILES,
        description: 'List files and directories at the specified path.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the directory to list'
                },
                recursive: {
                    type: 'string',
                    description: 'Whether to list recursively (true/false)'
                }
            },
            required: ['path']
        }
    },
    [TOOL_NAMES.LIST_CODE_DEFINITION_NAMES]: {
        name: TOOL_NAMES.LIST_CODE_DEFINITION_NAMES,
        description: 'List code definitions (functions, classes, etc.) in a file or directory.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path to analyze'
                }
            },
            required: ['path']
        }
    },
    [TOOL_NAMES.SEARCH_FILES]: {
        name: TOOL_NAMES.SEARCH_FILES,
        description: 'Search for files matching a pattern or containing specific text.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The directory to search in'
                },
                regex: {
                    type: 'string',
                    description: 'The regex pattern to search for'
                },
                filePattern: {
                    type: 'string',
                    description: 'Glob pattern to filter files'
                }
            },
            required: ['path', 'regex']
        }
    },
    [TOOL_NAMES.EXECUTE_COMMAND]: {
        name: TOOL_NAMES.EXECUTE_COMMAND,
        description: 'Execute a shell command in the terminal.',
        inputSchema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The command to execute'
                },
                requiresApproval: {
                    type: 'string',
                    description: 'Whether the command requires user approval (true/false)'
                }
            },
            required: ['command']
        }
    },
    [TOOL_NAMES.ASK_FOLLOWUP_QUESTION]: {
        name: TOOL_NAMES.ASK_FOLLOWUP_QUESTION,
        description: 'Ask the user a follow-up question to gather more information.',
        inputSchema: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'The question to ask the user'
                }
            },
            required: ['question']
        }
    },
    [TOOL_NAMES.ATTEMPT_COMPLETION]: {
        name: TOOL_NAMES.ATTEMPT_COMPLETION,
        description: 'Indicate that the task is complete and provide a summary.',
        inputSchema: {
            type: 'object',
            properties: {
                result: {
                    type: 'string',
                    description: 'The result or summary of the completed task'
                },
                command: {
                    type: 'string',
                    description: 'Optional command for the user to run'
                }
            },
            required: ['result']
        }
    },
    [TOOL_NAMES.BROWSER_ACTION]: {
        name: TOOL_NAMES.BROWSER_ACTION,
        description: 'Perform an action in the browser.',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'The action to perform',
                    enum: ['launch', 'click', 'type', 'scroll', 'screenshot', 'close']
                },
                url: { type: 'string', description: 'URL to navigate to' },
                selector: { type: 'string', description: 'CSS selector for the element' },
                text: { type: 'string', description: 'Text to type' },
                direction: { type: 'string', description: 'Scroll direction (up/down)' }
            },
            required: ['action']
        }
    },
    [TOOL_NAMES.USE_MCP_TOOL]: {
        name: TOOL_NAMES.USE_MCP_TOOL,
        description: 'Use a tool provided by an MCP server.',
        inputSchema: {
            type: 'object',
            properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                toolName: { type: 'string', description: 'Name of the tool to use' },
                arguments: { type: 'object', description: 'Arguments for the tool' }
            },
            required: ['serverName', 'toolName']
        }
    },
    [TOOL_NAMES.ACCESS_MCP_RESOURCE]: {
        name: TOOL_NAMES.ACCESS_MCP_RESOURCE,
        description: 'Access a resource provided by an MCP server.',
        inputSchema: {
            type: 'object',
            properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                uri: { type: 'string', description: 'URI of the resource' }
            },
            required: ['serverName', 'uri']
        }
    }
};

export function getToolDefinitions(toolNames?: ToolName[]): ToolDefinition[] {
    if (!toolNames) {
        return Object.values(TOOL_DEFINITIONS);
    }
    return toolNames.map(name => TOOL_DEFINITIONS[name]).filter(Boolean);
}

export function getToolByName(name: string): ToolDefinition | undefined {
    return TOOL_DEFINITIONS[name as ToolName];
}
