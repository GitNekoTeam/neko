export type AgentMode = 'agent' | 'plan' | 'ask' | 'edit';

export interface ModeConfig {
    id: AgentMode;
    name: string;
    description: string;
    icon: string;
    systemPromptModifier?: string;
    allowedTools?: string[];
    autoApprove?: boolean;
}

export const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
    agent: {
        id: 'agent',
        name: 'Agent',
        description: 'Full autonomous mode with all tools available',
        icon: 'robot',
        autoApprove: false
    },
    plan: {
        id: 'plan',
        name: 'Plan',
        description: 'Planning mode - creates a plan before executing',
        icon: 'list-ordered',
        systemPromptModifier: `Before taking any action, first create a detailed plan:
1. Analyze the request
2. Break down into steps
3. Identify files to modify
4. Present the plan for approval
5. Execute only after approval`,
        autoApprove: false
    },
    ask: {
        id: 'ask',
        name: 'Ask',
        description: 'Question-answering mode - no file modifications',
        icon: 'comment-discussion',
        allowedTools: ['read_file', 'list_files', 'search_files', 'list_code_definition_names'],
        systemPromptModifier: `You are in Ask mode. You can only read and analyze code, not modify it.
Focus on answering questions, explaining code, and providing guidance.
Do not use write_to_file, replace_in_file, or execute_command tools.`,
        autoApprove: true
    },
    edit: {
        id: 'edit',
        name: 'Edit',
        description: 'Direct editing mode - focused on code changes',
        icon: 'edit',
        allowedTools: ['read_file', 'write_to_file', 'replace_in_file', 'list_files', 'search_files'],
        systemPromptModifier: `You are in Edit mode. Focus on making precise code changes.
- Read files to understand context
- Make targeted edits
- Avoid running commands unless necessary`,
        autoApprove: false
    }
};

export function getModeConfig(mode: AgentMode): ModeConfig {
    return MODE_CONFIGS[mode];
}

export function getAllModes(): ModeConfig[] {
    return Object.values(MODE_CONFIGS);
}

export function isValidMode(mode: string): mode is AgentMode {
    return mode in MODE_CONFIGS;
}

export function getDefaultMode(): AgentMode {
    return 'agent';
}

export function getModeSystemPromptModifier(mode: AgentMode): string | undefined {
    return MODE_CONFIGS[mode].systemPromptModifier;
}

export function getModeAllowedTools(mode: AgentMode): string[] | undefined {
    return MODE_CONFIGS[mode].allowedTools;
}

export function isModeAutoApprove(mode: AgentMode): boolean {
    return MODE_CONFIGS[mode].autoApprove ?? false;
}

export function getModeIcon(mode: AgentMode): string {
    return MODE_CONFIGS[mode].icon;
}

export function getModeName(mode: AgentMode): string {
    return MODE_CONFIGS[mode].name;
}

export function getModeDescription(mode: AgentMode): string {
    return MODE_CONFIGS[mode].description;
}
