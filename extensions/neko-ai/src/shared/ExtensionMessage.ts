import { ApiUsage } from './api';

export type ExtensionMessageType =
    | 'state'
    | 'action'
    | 'partialMessage'
    | 'invoke'
    | 'workspaceUpdated'
    | 'selectedImages'
    | 'theme'
    | 'openRouterModels'
    | 'mcpServers'
    | 'enhancedPrompt';

export interface ExtensionMessage {
    type: ExtensionMessageType;
    [key: string]: unknown;
}

export interface StateMessage extends ExtensionMessage {
    type: 'state';
    state: ExtensionState;
}

export interface ActionMessage extends ExtensionMessage {
    type: 'action';
    action: ActionType;
    text?: string;
    images?: string[];
}

export interface PartialMessage extends ExtensionMessage {
    type: 'partialMessage';
    partialMessage: ChatMessage;
}

export interface InvokeMessage extends ExtensionMessage {
    type: 'invoke';
    invoke: 'sendMessage' | 'primaryButtonClick' | 'secondaryButtonClick';
    text?: string;
    images?: string[];
}

export type ActionType =
    | 'chatButtonClicked'
    | 'settingsButtonClicked'
    | 'historyButtonClicked'
    | 'mcpButtonClicked'
    | 'plusButtonClicked'
    | 'didBecomeVisible';

export interface ExtensionState {
    version: string;
    messages: ChatMessage[];
    taskHistory: TaskHistoryItem[];
    shouldShowAnnouncement: boolean;
    apiConfiguration: ApiConfigurationState;
    customInstructions?: string;
    mode: AgentMode;
    isStreaming: boolean;
    abort: boolean;
}

export interface ApiConfigurationState {
    provider: string;
    model?: string;
    hasApiKey: boolean;
}

export interface ChatMessage {
    id: string;
    type: 'say' | 'ask';
    role: 'user' | 'assistant' | 'system';
    content: MessageContent[];
    timestamp: number;
    isPartial?: boolean;
    usage?: ApiUsage;
    cost?: number;
}

export type MessageContent =
    | TextContent
    | ImageContent
    | ToolUseContent
    | ToolResultContent
    | CommandContent
    | CodeContent
    | ErrorContent;

export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    source: 'base64' | 'url';
    data: string;
    mediaType?: string;
}

export interface ToolUseContent {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
    status?: 'pending' | 'running' | 'completed' | 'error';
}

export interface ToolResultContent {
    type: 'tool_result';
    toolUseId: string;
    content: string;
    isError?: boolean;
}

export interface CommandContent {
    type: 'command';
    command: string;
    output?: string;
    exitCode?: number;
}

export interface CodeContent {
    type: 'code';
    language: string;
    code: string;
    path?: string;
}

export interface ErrorContent {
    type: 'error';
    error: string;
}

export interface TaskHistoryItem {
    id: string;
    name: string;
    timestamp: number;
    totalCost?: number;
    totalTokens?: number;
    messageCount: number;
}

export type AgentMode = 'agent' | 'plan' | 'ask' | 'edit';

export function createTextContent(text: string): TextContent {
    return { type: 'text', text };
}

export function createImageContent(data: string, source: 'base64' | 'url' = 'base64', mediaType?: string): ImageContent {
    return { type: 'image', source, data, mediaType };
}

export function createToolUseContent(id: string, name: string, input: Record<string, unknown>): ToolUseContent {
    return { type: 'tool_use', id, name, input, status: 'pending' };
}

export function createToolResultContent(toolUseId: string, content: string, isError?: boolean): ToolResultContent {
    return { type: 'tool_result', toolUseId, content, isError };
}
