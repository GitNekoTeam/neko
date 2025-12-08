declare module '@anthropic-ai/sdk' {
    export interface TextBlock {
        type: 'text';
        text: string;
    }

    export interface ToolUseBlock {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
    }

    export type ContentBlock = TextBlock | ToolUseBlock;

    export interface Message {
        id: string;
        type: 'message';
        role: 'assistant';
        content: ContentBlock[];
        model: string;
        stop_reason: string | null;
        stop_sequence: string | null;
        usage: {
            input_tokens: number;
            output_tokens: number;
        };
    }

    export interface TextBlockParam {
        type: 'text';
        text: string;
    }

    export interface ImageBlockParam {
        type: 'image';
        source: {
            type: 'base64';
            media_type: string;
            data: string;
        };
    }

    export type ContentBlockParam = TextBlockParam | ImageBlockParam;

    export interface MessageParam {
        role: 'user' | 'assistant';
        content: string | ContentBlockParam[];
    }

    export interface MessageCreateParams {
        model: string;
        max_tokens: number;
        messages: MessageParam[];
        system?: string;
        temperature?: number;
        top_p?: number;
        stop_sequences?: string[];
        stream?: boolean;
    }

    export interface MessageCreateParamsBase extends MessageCreateParams {
        stream?: boolean;
    }

    export interface MessageCreateParamsNonStreaming extends MessageCreateParamsBase {
        stream?: false;
    }

    export interface MessageCreateParamsStreaming extends MessageCreateParamsBase {
        stream: true;
    }

    export interface TextDelta {
        type: 'text_delta';
        text: string;
    }

    export interface InputJsonDelta {
        type: 'input_json_delta';
        partial_json: string;
    }

    export type Delta = TextDelta | InputJsonDelta;

    export interface ContentBlockDeltaEvent {
        type: 'content_block_delta';
        index: number;
        delta: Delta;
    }

    export interface ContentBlockStartEvent {
        type: 'content_block_start';
        index: number;
        content_block: ContentBlock;
    }

    export interface ContentBlockStopEvent {
        type: 'content_block_stop';
        index: number;
    }

    export interface MessageStartEvent {
        type: 'message_start';
        message: Message;
    }

    export interface MessageDeltaEvent {
        type: 'message_delta';
        delta: {
            stop_reason: string | null;
            stop_sequence: string | null;
        };
        usage: {
            output_tokens: number;
        };
    }

    export interface MessageStopEvent {
        type: 'message_stop';
    }

    export type RawMessageStreamEvent =
        | MessageStartEvent
        | ContentBlockStartEvent
        | ContentBlockDeltaEvent
        | ContentBlockStopEvent
        | MessageDeltaEvent
        | MessageStopEvent;

    export interface Stream<T> extends AsyncIterable<T> {
        controller: AbortController;
    }

    export interface MessageStream extends AsyncIterable<RawMessageStreamEvent> {
        on(event: 'text', callback: (text: string) => void): this;
        on(event: 'message', callback: (message: Message) => void): this;
        finalMessage(): Promise<Message>;
    }

    export interface RequestOptions {
        signal?: AbortSignal;
        headers?: Record<string, string>;
    }

    export interface Messages {
        create(params: MessageCreateParamsNonStreaming, options?: RequestOptions): Promise<Message>;
        create(params: MessageCreateParamsStreaming, options?: RequestOptions): Promise<Stream<RawMessageStreamEvent>>;
        create(body: MessageCreateParamsBase, options?: RequestOptions): Promise<Message | Stream<RawMessageStreamEvent>>;
        stream(params: Omit<MessageCreateParams, 'stream'>, options?: RequestOptions): MessageStream;
    }

    export interface AnthropicOptions {
        apiKey: string;
        baseURL?: string;
        timeout?: number;
        maxRetries?: number;
    }

    export default class Anthropic {
        constructor(options: AnthropicOptions);
        messages: Messages;
    }
}
