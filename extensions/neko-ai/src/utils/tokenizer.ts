interface TiktokenEncoder {
    encode(text: string): number[];
    decode(tokens: number[]): string;
}

let encoder: TiktokenEncoder | null = null;
let encoderPromise: Promise<TiktokenEncoder> | null = null;

async function getEncoder(): Promise<TiktokenEncoder> {
    if (encoder) {
        return encoder;
    }
    if (!encoderPromise) {
        encoderPromise = import('js-tiktoken').then(module => {
            encoder = module.getEncoding('cl100k_base');
            return encoder;
        });
    }
    return encoderPromise;
}

export async function countTokens(text: string): Promise<number> {
    try {
        const enc = await getEncoder();
        return enc.encode(text).length;
    } catch {
        return Math.ceil(text.length / 4);
    }
}

export async function truncateToTokens(text: string, maxTokens: number): Promise<string> {
    const enc = await getEncoder();
    const tokens = enc.encode(text);
    if (tokens.length <= maxTokens) {
        return text;
    }
    return enc.decode(tokens.slice(0, maxTokens));
}

export async function splitIntoChunks(text: string, chunkSize: number, overlap: number = 100): Promise<string[]> {
    const enc = await getEncoder();
    const tokens = enc.encode(text);
    const chunks: string[] = [];
    
    let start = 0;
    while (start < tokens.length) {
        const end = Math.min(start + chunkSize, tokens.length);
        chunks.push(enc.decode(tokens.slice(start, end)));
        start = end - overlap;
        if (start >= tokens.length - overlap) break;
    }
    
    return chunks;
}

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
