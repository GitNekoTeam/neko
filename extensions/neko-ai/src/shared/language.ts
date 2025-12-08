export interface LanguageConfig {
    id: string;
    name: string;
    extensions: string[];
    aliases: string[];
    commentSingle?: string;
    commentMultiStart?: string;
    commentMultiEnd?: string;
}

export const LANGUAGE_CONFIGS: LanguageConfig[] = [
    {
        id: 'typescript',
        name: 'TypeScript',
        extensions: ['.ts', '.mts', '.cts'],
        aliases: ['ts'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'typescriptreact',
        name: 'TypeScript React',
        extensions: ['.tsx'],
        aliases: ['tsx'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'javascript',
        name: 'JavaScript',
        extensions: ['.js', '.mjs', '.cjs'],
        aliases: ['js'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'javascriptreact',
        name: 'JavaScript React',
        extensions: ['.jsx'],
        aliases: ['jsx'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'python',
        name: 'Python',
        extensions: ['.py', '.pyw', '.pyi'],
        aliases: ['py'],
        commentSingle: '#',
        commentMultiStart: '"""',
        commentMultiEnd: '"""'
    },
    {
        id: 'java',
        name: 'Java',
        extensions: ['.java'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'csharp',
        name: 'C#',
        extensions: ['.cs'],
        aliases: ['cs'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'cpp',
        name: 'C++',
        extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
        aliases: ['c++'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'c',
        name: 'C',
        extensions: ['.c', '.h'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'go',
        name: 'Go',
        extensions: ['.go'],
        aliases: ['golang'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'rust',
        name: 'Rust',
        extensions: ['.rs'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'ruby',
        name: 'Ruby',
        extensions: ['.rb', '.rake', '.gemspec'],
        aliases: [],
        commentSingle: '#',
        commentMultiStart: '=begin',
        commentMultiEnd: '=end'
    },
    {
        id: 'php',
        name: 'PHP',
        extensions: ['.php', '.phtml'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'swift',
        name: 'Swift',
        extensions: ['.swift'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'kotlin',
        name: 'Kotlin',
        extensions: ['.kt', '.kts'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'scala',
        name: 'Scala',
        extensions: ['.scala', '.sc'],
        aliases: [],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'html',
        name: 'HTML',
        extensions: ['.html', '.htm'],
        aliases: [],
        commentMultiStart: '<!--',
        commentMultiEnd: '-->'
    },
    {
        id: 'css',
        name: 'CSS',
        extensions: ['.css'],
        aliases: [],
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'scss',
        name: 'SCSS',
        extensions: ['.scss'],
        aliases: ['sass'],
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'json',
        name: 'JSON',
        extensions: ['.json', '.jsonc'],
        aliases: []
    },
    {
        id: 'yaml',
        name: 'YAML',
        extensions: ['.yaml', '.yml'],
        aliases: [],
        commentSingle: '#'
    },
    {
        id: 'markdown',
        name: 'Markdown',
        extensions: ['.md', '.markdown'],
        aliases: ['md']
    },
    {
        id: 'sql',
        name: 'SQL',
        extensions: ['.sql'],
        aliases: [],
        commentSingle: '--',
        commentMultiStart: '/*',
        commentMultiEnd: '*/'
    },
    {
        id: 'shellscript',
        name: 'Shell Script',
        extensions: ['.sh', '.bash', '.zsh'],
        aliases: ['bash', 'shell'],
        commentSingle: '#'
    },
    {
        id: 'powershell',
        name: 'PowerShell',
        extensions: ['.ps1', '.psm1', '.psd1'],
        aliases: ['ps'],
        commentSingle: '#',
        commentMultiStart: '<#',
        commentMultiEnd: '#>'
    },
    {
        id: 'vue',
        name: 'Vue',
        extensions: ['.vue'],
        aliases: [],
        commentMultiStart: '<!--',
        commentMultiEnd: '-->'
    },
    {
        id: 'svelte',
        name: 'Svelte',
        extensions: ['.svelte'],
        aliases: [],
        commentMultiStart: '<!--',
        commentMultiEnd: '-->'
    }
];

export function getLanguageById(id: string): LanguageConfig | undefined {
    return LANGUAGE_CONFIGS.find(lang => lang.id === id);
}

export function getLanguageByExtension(extension: string): LanguageConfig | undefined {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return LANGUAGE_CONFIGS.find(lang => lang.extensions.includes(ext.toLowerCase()));
}

export function getLanguageByAlias(alias: string): LanguageConfig | undefined {
    return LANGUAGE_CONFIGS.find(lang => 
        lang.aliases.includes(alias.toLowerCase()) || 
        lang.id === alias.toLowerCase()
    );
}

export function getLanguageIdForFile(filePath: string): string {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const lang = getLanguageByExtension(ext);
    return lang?.id || 'plaintext';
}

export function getAllLanguageIds(): string[] {
    return LANGUAGE_CONFIGS.map(lang => lang.id);
}

export function isCodeFile(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return getLanguageByExtension(ext) !== undefined;
}

export function getCommentSyntax(languageId: string): {
    single?: string;
    multiStart?: string;
    multiEnd?: string;
} {
    const lang = getLanguageById(languageId);
    return {
        single: lang?.commentSingle,
        multiStart: lang?.commentMultiStart,
        multiEnd: lang?.commentMultiEnd
    };
}

export function wrapInComment(text: string, languageId: string): string {
    const syntax = getCommentSyntax(languageId);

    if (syntax.single) {
        return text.split('\n').map(line => `${syntax.single} ${line}`).join('\n');
    }

    if (syntax.multiStart && syntax.multiEnd) {
        return `${syntax.multiStart}\n${text}\n${syntax.multiEnd}`;
    }

    return text;
}
