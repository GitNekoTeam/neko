interface ContentBlockParam {
    type: string;
    text?: string;
    source?: {
        type: string;
        media_type?: string;
        data?: string;
    };
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | ContentBlockParam[];
}

interface ImageBlockParam {
    type: 'image';
    source: {
        type: 'base64' | 'url';
        media_type?: string;
        data: string;
    };
}

interface TiktokenEncoder {
    encode(text: string): number[];
}

let encoder: TiktokenEncoder | null = null;

async function getEncoder(): Promise<TiktokenEncoder> {
    if (!encoder) {
        const tiktoken = await import('js-tiktoken');
        encoder = tiktoken.encodingForModel('gpt-4');
    }
    return encoder;
}

export async function tiktoken(
    content: ContentBlockParam[]
): Promise<number> {
    const enc = await getEncoder();
    let totalTokens = 0;

    for (const block of content) {
        if (block.type === 'text' && block.text) {
            totalTokens += enc.encode(block.text).length;
        } else if (block.type === 'image') {
            totalTokens += estimateImageTokens(block as ImageBlockParam);
        } else if (block.type === 'tool_use') {
            if (block.input) {
                totalTokens += enc.encode(JSON.stringify(block.input)).length;
            }
            if (block.name) {
                totalTokens += enc.encode(block.name).length;
            }
        } else if (block.type === 'tool_result') {
            if (typeof block.content === 'string') {
                totalTokens += enc.encode(block.content).length;
            } else if (Array.isArray(block.content)) {
                for (const item of block.content) {
                    if (item.type === 'text' && item.text) {
                        totalTokens += enc.encode(item.text).length;
                    } else if (item.type === 'image') {
                        totalTokens += estimateImageTokens(item as ImageBlockParam);
                    }
                }
            }
        }
    }

    return totalTokens;
}

function estimateImageTokens(imageBlock: ImageBlockParam): number {
    if (imageBlock.source.type === 'base64') {
        const base64Length = imageBlock.source.data.length;
        const bytes = (base64Length * 3) / 4;
        const pixels = bytes / 3;
        const side = Math.sqrt(pixels);
        const tiles = Math.ceil(side / 512) * Math.ceil(side / 512);
        return tiles * 170 + 85;
    }
    return 1000;
}

export function freeEncoder(): void {
    encoder = null;
}
