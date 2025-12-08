import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface ParseXmlOptions {
    processEntities?: boolean;
    preserveOrder?: boolean;
    ignoreAttributes?: boolean;
}

export function parseXml(
    xmlString: string,
    stopNodes?: string[],
    options?: ParseXmlOptions
): unknown {
    const processEntities = options?.processEntities ?? true;
    const preserveOrder = options?.preserveOrder ?? false;
    const ignoreAttributes = options?.ignoreAttributes ?? false;

    try {
        const parser = new XMLParser({
            ignoreAttributes,
            attributeNamePrefix: '@_',
            parseAttributeValue: false,
            parseTagValue: false,
            trimValues: true,
            processEntities,
            preserveOrder,
            stopNodes: stopNodes ?? []
        });

        return parser.parse(xmlString);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to parse XML: ${errorMessage}`);
    }
}

export function parseXmlForDiff(xmlString: string, stopNodes?: string[]): unknown {
    return parseXml(xmlString, stopNodes, { processEntities: false });
}

export function buildXml(obj: unknown, options?: { format?: boolean }): string {
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: options?.format ?? false
    });

    return builder.build(obj);
}

export function extractXmlContent(
    xmlString: string,
    tagName: string
): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = xmlString.match(regex);
    return match ? match[1].trim() : null;
}

export function extractAllXmlTags(
    xmlString: string,
    tagName: string
): string[] {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(xmlString)) !== null) {
        matches.push(match[1].trim());
    }

    return matches;
}

export function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function unescapeXml(str: string): string {
    return str
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}
