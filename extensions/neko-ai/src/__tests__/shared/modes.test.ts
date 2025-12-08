import {
    AgentMode,
    MODE_CONFIGS,
    getModeConfig,
    getAllModes,
    isValidMode,
    getDefaultMode,
    getModeSystemPromptModifier,
    getModeAllowedTools,
    isModeAutoApprove,
    getModeIcon,
    getModeName,
    getModeDescription
} from '../../shared/modes';

describe('MODE_CONFIGS', () => {
    it('should have all four modes', () => {
        expect(MODE_CONFIGS.agent).toBeDefined();
        expect(MODE_CONFIGS.plan).toBeDefined();
        expect(MODE_CONFIGS.ask).toBeDefined();
        expect(MODE_CONFIGS.edit).toBeDefined();
    });

    it('should have correct agent mode config', () => {
        const agent = MODE_CONFIGS.agent;
        
        expect(agent.id).toBe('agent');
        expect(agent.name).toBe('Agent');
        expect(agent.autoApprove).toBe(false);
    });

    it('should have correct plan mode config', () => {
        const plan = MODE_CONFIGS.plan;
        
        expect(plan.id).toBe('plan');
        expect(plan.name).toBe('Plan');
        expect(plan.systemPromptModifier).toBeDefined();
    });

    it('should have correct ask mode config', () => {
        const ask = MODE_CONFIGS.ask;
        
        expect(ask.id).toBe('ask');
        expect(ask.name).toBe('Ask');
        expect(ask.allowedTools).toBeDefined();
        expect(ask.allowedTools).toContain('read_file');
        expect(ask.allowedTools).not.toContain('write_to_file');
        expect(ask.autoApprove).toBe(true);
    });

    it('should have correct edit mode config', () => {
        const edit = MODE_CONFIGS.edit;
        
        expect(edit.id).toBe('edit');
        expect(edit.name).toBe('Edit');
        expect(edit.allowedTools).toContain('write_to_file');
        expect(edit.allowedTools).not.toContain('execute_command');
    });
});

describe('getModeConfig', () => {
    it('should return config for valid mode', () => {
        const config = getModeConfig('agent');
        
        expect(config.id).toBe('agent');
    });

    it('should return config for all modes', () => {
        const modes: AgentMode[] = ['agent', 'plan', 'ask', 'edit'];
        
        for (const mode of modes) {
            const config = getModeConfig(mode);
            expect(config.id).toBe(mode);
        }
    });
});

describe('getAllModes', () => {
    it('should return all mode configs', () => {
        const modes = getAllModes();
        
        expect(modes).toHaveLength(4);
        expect(modes.map(m => m.id)).toContain('agent');
        expect(modes.map(m => m.id)).toContain('plan');
        expect(modes.map(m => m.id)).toContain('ask');
        expect(modes.map(m => m.id)).toContain('edit');
    });
});

describe('isValidMode', () => {
    it('should return true for valid modes', () => {
        expect(isValidMode('agent')).toBe(true);
        expect(isValidMode('plan')).toBe(true);
        expect(isValidMode('ask')).toBe(true);
        expect(isValidMode('edit')).toBe(true);
    });

    it('should return false for invalid modes', () => {
        expect(isValidMode('invalid')).toBe(false);
        expect(isValidMode('')).toBe(false);
        expect(isValidMode('AGENT')).toBe(false);
    });
});

describe('getDefaultMode', () => {
    it('should return agent as default', () => {
        expect(getDefaultMode()).toBe('agent');
    });
});

describe('getModeSystemPromptModifier', () => {
    it('should return modifier for plan mode', () => {
        const modifier = getModeSystemPromptModifier('plan');
        
        expect(modifier).toBeDefined();
        expect(modifier).toContain('plan');
    });

    it('should return modifier for ask mode', () => {
        const modifier = getModeSystemPromptModifier('ask');
        
        expect(modifier).toBeDefined();
        expect(modifier).toContain('Ask mode');
    });

    it('should return undefined for agent mode', () => {
        const modifier = getModeSystemPromptModifier('agent');
        
        expect(modifier).toBeUndefined();
    });
});

describe('getModeAllowedTools', () => {
    it('should return tools for ask mode', () => {
        const tools = getModeAllowedTools('ask');
        
        expect(tools).toBeDefined();
        expect(tools).toContain('read_file');
        expect(tools).toContain('list_files');
    });

    it('should return tools for edit mode', () => {
        const tools = getModeAllowedTools('edit');
        
        expect(tools).toBeDefined();
        expect(tools).toContain('write_to_file');
        expect(tools).toContain('replace_in_file');
    });

    it('should return undefined for agent mode', () => {
        const tools = getModeAllowedTools('agent');
        
        expect(tools).toBeUndefined();
    });
});

describe('isModeAutoApprove', () => {
    it('should return true for ask mode', () => {
        expect(isModeAutoApprove('ask')).toBe(true);
    });

    it('should return false for other modes', () => {
        expect(isModeAutoApprove('agent')).toBe(false);
        expect(isModeAutoApprove('plan')).toBe(false);
        expect(isModeAutoApprove('edit')).toBe(false);
    });
});

describe('getModeIcon', () => {
    it('should return icon for each mode', () => {
        expect(getModeIcon('agent')).toBe('robot');
        expect(getModeIcon('plan')).toBe('list-ordered');
        expect(getModeIcon('ask')).toBe('comment-discussion');
        expect(getModeIcon('edit')).toBe('edit');
    });
});

describe('getModeName', () => {
    it('should return name for each mode', () => {
        expect(getModeName('agent')).toBe('Agent');
        expect(getModeName('plan')).toBe('Plan');
        expect(getModeName('ask')).toBe('Ask');
        expect(getModeName('edit')).toBe('Edit');
    });
});

describe('getModeDescription', () => {
    it('should return description for each mode', () => {
        expect(getModeDescription('agent')).toContain('autonomous');
        expect(getModeDescription('plan')).toContain('plan');
        expect(getModeDescription('ask')).toContain('Question');
        expect(getModeDescription('edit')).toContain('editing');
    });
});
