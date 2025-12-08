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
}

interface ImageBlockSource {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
}

interface Tool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}

interface ChatCompletionTool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | OpenAIContentPart[];
    name?: string;
    tool_call_id?: string;
    tool_calls?: OpenAIToolCall[];
}

export interface OpenAIContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export function convertToOpenAIMessages(
    systemPrompt: string,
    messages: MessageParam[]
): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (systemPrompt) {
        result.push({
            role: 'system',
            content: systemPrompt
        });
    }

    for (const message of messages) {
        const converted = convertMessage(message);
        if (converted) {
            result.push(converted);
        }
    }

    return result;
}

function convertMessage(message: MessageParam): OpenAIMessage | null {
    if (message.role === 'user') {
        return convertUserMessage(message);
    } else if (message.role === 'assistant') {
        return convertAssistantMessage(message);
    }
    return null;
}

function convertUserMessage(message: MessageParam): OpenAIMessage {
    if (typeof message.content === 'string') {
        return {
            role: 'user',
            content: message.content
        };
    }

    const contentParts: OpenAIContentPart[] = [];

    for (const block of message.content) {
        if (block.type === 'text') {
            contentParts.push({
                type: 'text',
                text: block.text
            });
        } else if (block.type === 'image' && block.source) {
            const imageUrl = convertImageSource(block.source as ImageBlockSource);
            if (imageUrl) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: imageUrl }
                });
            }
        } else if (block.type === 'tool_result') {
            const content = typeof block.content === 'string' 
                ? block.content 
                : JSON.stringify(block.content);
            contentParts.push({
                type: 'text',
                text: `Tool result for ${block.tool_use_id}: ${content}`
            });
        }
    }

    return {
        role: 'user',
        content: contentParts.length === 1 && contentParts[0].type === 'text'
            ? contentParts[0].text!
            : contentParts
    };
}

function convertAssistantMessage(message: MessageParam): OpenAIMessage {
    if (typeof message.content === 'string') {
        return {
            role: 'assistant',
            content: message.content
        };
    }

    let textContent = '';
    const toolCalls: OpenAIToolCall[] = [];

    for (const block of message.content) {
        if (block.type === 'text') {
            textContent += block.text;
        } else if (block.type === 'tool_use' && block.id && block.name) {
            toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input || {})
                }
            });
        }
    }

    const result: OpenAIMessage = {
        role: 'assistant',
        content: textContent
    };

    if (toolCalls.length > 0) {
        result.tool_calls = toolCalls;
    }

    return result;
}

function convertImageSource(source: ImageBlockSource): string | null {
    if (source.type === 'base64' && source.data) {
        return `data:${source.media_type};base64,${source.data}`;
    }
    return null;
}

export function convertOpenAITools(tools: ChatCompletionTool[]): Tool[] {
    return tools.map(tool => ({
        name: tool.function.name ?? '',
        description: tool.function.description ?? '',
        input_schema: tool.function.parameters ?? {}
    }));
}
