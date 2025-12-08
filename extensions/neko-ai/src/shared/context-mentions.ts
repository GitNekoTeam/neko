export type MentionType = 
    | 'file'
    | 'folder'
    | 'url'
    | 'problems'
    | 'terminal'
    | 'git'
    | 'codebase';

export interface ContextMention {
    type: MentionType;
    value: string;
    displayName: string;
    startIndex: number;
    endIndex: number;
}

export interface MentionConfig {
    type: MentionType;
    prefix: string;
    description: string;
    icon: string;
    requiresValue: boolean;
}

export const MENTION_CONFIGS: Record<MentionType, MentionConfig> = {
    file: {
        type: 'file',
        prefix: '@file',
        description: 'Reference a specific file',
        icon: 'file',
        requiresValue: true
    },
    folder: {
        type: 'folder',
        prefix: '@folder',
        description: 'Reference a folder',
        icon: 'folder',
        requiresValue: true
    },
    url: {
        type: 'url',
        prefix: '@url',
        description: 'Reference a URL',
        icon: 'link',
        requiresValue: true
    },
    problems: {
        type: 'problems',
        prefix: '@problems',
        description: 'Include current problems/diagnostics',
        icon: 'warning',
        requiresValue: false
    },
    terminal: {
        type: 'terminal',
        prefix: '@terminal',
        description: 'Include terminal output',
        icon: 'terminal',
        requiresValue: false
    },
    git: {
        type: 'git',
        prefix: '@git',
        description: 'Include git diff',
        icon: 'git-commit',
        requiresValue: false
    },
    codebase: {
        type: 'codebase',
        prefix: '@codebase',
        description: 'Search the codebase',
        icon: 'search',
        requiresValue: false
    }
};

const MENTION_REGEX = /@(file|folder|url|problems|terminal|git|codebase)(?::([^\s]+))?/g;

export function parseMentions(text: string): ContextMention[] {
    const mentions: ContextMention[] = [];
    let match;

    while ((match = MENTION_REGEX.exec(text)) !== null) {
        const type = match[1] as MentionType;
        const value = match[2] || '';
        const config = MENTION_CONFIGS[type];

        if (config.requiresValue && !value) {
            continue;
        }

        mentions.push({
            type,
            value,
            displayName: value || type,
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }

    return mentions;
}

export function removeMentions(text: string): string {
    return text.replace(MENTION_REGEX, '').trim();
}

export function formatMention(type: MentionType, value?: string): string {
    const config = MENTION_CONFIGS[type];
    if (config.requiresValue && value) {
        return `${config.prefix}:${value}`;
    }
    return config.prefix;
}

export function getMentionConfig(type: MentionType): MentionConfig {
    return MENTION_CONFIGS[type];
}

export function getAllMentionTypes(): MentionType[] {
    return Object.keys(MENTION_CONFIGS) as MentionType[];
}

export function getMentionSuggestions(query: string): MentionConfig[] {
    const lowerQuery = query.toLowerCase();
    return Object.values(MENTION_CONFIGS).filter(config =>
        config.prefix.toLowerCase().includes(lowerQuery) ||
        config.description.toLowerCase().includes(lowerQuery)
    );
}

export function validateMention(mention: ContextMention): boolean {
    const config = MENTION_CONFIGS[mention.type];
    if (config.requiresValue && !mention.value) {
        return false;
    }
    return true;
}

export function extractFilePaths(mentions: ContextMention[]): string[] {
    return mentions
        .filter(m => m.type === 'file' || m.type === 'folder')
        .map(m => m.value);
}

export function extractUrls(mentions: ContextMention[]): string[] {
    return mentions
        .filter(m => m.type === 'url')
        .map(m => m.value);
}
