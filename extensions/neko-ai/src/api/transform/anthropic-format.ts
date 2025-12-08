interface MessageParam {
    role: 'user' | 'assistant';
    content: string | ContentBlockParam[];
}

interface ContentBlockParam {
    type: string;
    text?: string;
    source?: {
        type: string;
        media_type?: string;
        data?: string;
    };
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | ContentBlockParam[];
    is_error?: boolean;
}

interface ContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
}

interface TextBlock extends ContentBlock {
    type: 'text';
    text: string;
}

interface ToolUseBlock extends ContentBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

interface Tool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}

interface MessageCreateParams {
    model: string;
    max_tokens: number;
    messages: MessageParam[];
    stream?: boolean;
    system?: string;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop_sequences?: string[];
    tools?: Tool[];
}

interface TextBlockParam {
    type: 'text';
    text: string;
}

interface ImageBlockParam {
    type: 'image';
    source: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data: string;
    };
}

interface ToolResultBlockParam {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
}

export interface AnthropicRequestOptions {
    model: string;
    maxTokens: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    stream?: boolean;
}

export function buildAnthropicRequest(
    systemPrompt: string,
    messages: MessageParam[],
    tools: Tool[] | undefined,
    options: AnthropicRequestOptions
): MessageCreateParams {
    const request: MessageCreateParams = {
        model: options.model,
        max_tokens: options.maxTokens,
        messages: filterMessages(messages),
        stream: options.stream ?? true
    };

    if (systemPrompt) {
        request.system = systemPrompt;
    }

    if (options.temperature !== undefined) {
        request.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
        request.top_p = options.topP;
    }

    if (options.topK !== undefined) {
        request.top_k = options.topK;
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
        request.stop_sequences = options.stopSequences;
    }

    if (tools && tools.length > 0) {
        request.tools = tools;
    }

    return request;
}

function filterMessages(messages: MessageParam[]): MessageParam[] {
    return messages.filter(message => {
        if (typeof message.content === 'string') {
            return message.content.trim().length > 0;
        }
        return message.content.length > 0;
    });
}

export function extractTextFromContent(content: ContentBlock[]): string {
    return content
        .filter((block): block is TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');
}

export function extractToolUseFromContent(content: ContentBlock[]): ToolUseBlock[] {
    return content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
    );
}

export function createToolResultBlock(
    toolUseId: string,
    result: string,
    isError: boolean = false
): ToolResultBlockParam {
    return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: result,
        is_error: isError
    };
}

export function createTextBlock(text: string): TextBlockParam {
    return {
        type: 'text',
        text
    };
}

export function createImageBlock(
    base64Data: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): ImageBlockParam {
    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
        }
    };
}

export function mergeConsecutiveMessages(messages: MessageParam[]): MessageParam[] {
    if (messages.length === 0) return [];

    const result: MessageParam[] = [];
    let current = messages[0];

    for (let i = 1; i < messages.length; i++) {
        const next = messages[i];

        if (current.role === next.role) {
            current = mergeMessages(current, next);
        } else {
            result.push(current);
            current = next;
        }
    }

    result.push(current);
    return result;
}

function mergeMessages(a: MessageParam, b: MessageParam): MessageParam {
    const contentA = normalizeContent(a.content);
    const contentB = normalizeContent(b.content);

    return {
        role: a.role,
        content: [...contentA, ...contentB]
    };
}

function normalizeContent(
    content: string | ContentBlockParam[]
): ContentBlockParam[] {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    return content;
}
