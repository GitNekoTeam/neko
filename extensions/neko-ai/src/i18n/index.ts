import * as vscode from 'vscode';
import { ar } from './locales/ar';
import { ca } from './locales/ca';
import { cs } from './locales/cs';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { ptBR } from './locales/pt-BR';
import { ru } from './locales/ru';
import { th } from './locales/th';
import { tr } from './locales/tr';
import { uk } from './locales/uk';
import { vi } from './locales/vi';
import { zhCN } from './locales/zh-CN';
import { zhTW } from './locales/zh-TW';

type TranslationKey = string;
type TranslationParams = Record<string, string | number>;

interface Translations {
    [key: string]: string | Translations;
}

const translations: Record<string, Translations> = {
    ar,
    ca,
    cs,
    de,
    en,
    es,
    fr,
    hi,
    id,
    it,
    ja,
    ko,
    nl,
    pl,
    'pt-BR': ptBR,
    pt: ptBR,
    ru,
    th,
    tr,
    uk,
    vi,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    zh: zhCN
};

let currentLocale = 'en';

export function initI18n(): void {
    const config = vscode.workspace.getConfiguration('neko-ai');
    const configLocale = config.get<string>('locale');
    const systemLocale = vscode.env.language;
    
    const locale = configLocale || systemLocale;
    
    if (translations[locale]) {
        currentLocale = locale;
    } else {
        const baseLocale = locale.split('-')[0];
        if (translations[baseLocale]) {
            currentLocale = baseLocale;
        } else if (locale.startsWith('zh')) {
            currentLocale = 'zh-CN';
        } else if (locale.startsWith('pt')) {
            currentLocale = 'pt-BR';
        } else {
            currentLocale = 'en';
        }
    }
}

export function setLocale(locale: string): void {
    if (translations[locale]) {
        currentLocale = locale;
    } else {
        const baseLocale = locale.split('-')[0];
        if (translations[baseLocale]) {
            currentLocale = baseLocale;
        }
    }
}

export function getLocale(): string {
    return currentLocale;
}

export function t(key: TranslationKey, params?: TranslationParams): string {
    const keys = key.split('.');
    let value: string | Translations | undefined = translations[currentLocale];

    for (const k of keys) {
        if (typeof value === 'object' && value !== null) {
            value = value[k];
        } else {
            value = undefined;
            break;
        }
    }

    if (typeof value !== 'string') {
        let fallback: string | Translations | undefined = translations['en'];
        for (const k of keys) {
            if (typeof fallback === 'object' && fallback !== null) {
                fallback = fallback[k];
            } else {
                fallback = undefined;
                break;
            }
        }
        value = typeof fallback === 'string' ? fallback : key;
    }

    if (params && typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
            return params[paramKey]?.toString() || `{${paramKey}}`;
        });
    }

    return value as string;
}

export function getSupportedLocales(): Array<{ id: string; name: string }> {
    return [
        { id: 'ar', name: 'العربية' },
        { id: 'ca', name: 'Catala' },
        { id: 'cs', name: 'Cestina' },
        { id: 'de', name: 'Deutsch' },
        { id: 'en', name: 'English' },
        { id: 'es', name: 'Espanol' },
        { id: 'fr', name: 'Francais' },
        { id: 'hi', name: 'Hindi' },
        { id: 'id', name: 'Bahasa Indonesia' },
        { id: 'it', name: 'Italiano' },
        { id: 'ja', name: 'Japanese' },
        { id: 'ko', name: 'Korean' },
        { id: 'nl', name: 'Nederlands' },
        { id: 'pl', name: 'Polski' },
        { id: 'pt-BR', name: 'Portugues (Brasil)' },
        { id: 'ru', name: 'Russian' },
        { id: 'th', name: 'Thai' },
        { id: 'tr', name: 'Turkce' },
        { id: 'uk', name: 'Ukrainian' },
        { id: 'vi', name: 'Tieng Viet' },
        { id: 'zh-CN', name: 'Simplified Chinese' },
        { id: 'zh-TW', name: 'Traditional Chinese' }
    ];
}

export function getTranslations(locale?: string): Translations {
    return translations[locale || currentLocale] || translations['en'];
}
