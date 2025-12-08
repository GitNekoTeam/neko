export type WebviewMessageType =
    | 'webviewDidLaunch'
    | 'newTask'
    | 'askResponse'
    | 'clearTask'
    | 'didShowAnnouncement'
    | 'selectImages'
    | 'exportCurrentTask'
    | 'showTaskWithId'
    | 'deleteTaskWithId'
    | 'exportTaskWithId'
    | 'resetState'
    | 'requestOllamaModels'
    | 'requestLmStudioModels'
    | 'openImage'
    | 'openFile'
    | 'openMcpSettings'
    | 'restartMcpServer'
    | 'cancelTask'
    | 'setMode'
    | 'applyDiff'
    | 'rejectDiff'
    | 'retryMessage'
    | 'copyToClipboard'
    | 'insertAtCursor'
    | 'openInEditor'
    | 'openExternal'
    | 'updateApiConfiguration'
    | 'updateCustomInstructions'
    | 'enhancePrompt'
    | 'dropFiles'
    | 'dropFolders'
    | 'dropImages';

export interface WebviewMessage {
    type: WebviewMessageType;
    [key: string]: unknown;
}

export interface NewTaskMessage extends WebviewMessage {
    type: 'newTask';
    text: string;
    images?: string[];
    mode?: string;
}

export interface AskResponseMessage extends WebviewMessage {
    type: 'askResponse';
    response: 'yesButtonClicked' | 'noButtonClicked' | 'messageResponse';
    text?: string;
    images?: string[];
}

export interface SelectImagesMessage extends WebviewMessage {
    type: 'selectImages';
}

export interface ShowTaskMessage extends WebviewMessage {
    type: 'showTaskWithId';
    id: string;
}

export interface DeleteTaskMessage extends WebviewMessage {
    type: 'deleteTaskWithId';
    id: string;
}

export interface SetModeMessage extends WebviewMessage {
    type: 'setMode';
    mode: string;
}

export interface ApplyDiffMessage extends WebviewMessage {
    type: 'applyDiff';
    path: string;
    diff: string;
}

export interface RejectDiffMessage extends WebviewMessage {
    type: 'rejectDiff';
    path: string;
}

export interface CopyToClipboardMessage extends WebviewMessage {
    type: 'copyToClipboard';
    text: string;
}

export interface InsertAtCursorMessage extends WebviewMessage {
    type: 'insertAtCursor';
    text: string;
}

export interface OpenFileMessage extends WebviewMessage {
    type: 'openFile';
    path: string;
    line?: number;
}

export interface OpenExternalMessage extends WebviewMessage {
    type: 'openExternal';
    url: string;
}

export interface UpdateApiConfigMessage extends WebviewMessage {
    type: 'updateApiConfiguration';
    configuration: Record<string, unknown>;
}

export interface DropFilesMessage extends WebviewMessage {
    type: 'dropFiles';
    paths: string[];
}

export interface DropFoldersMessage extends WebviewMessage {
    type: 'dropFolders';
    paths: string[];
}

export interface DropImagesMessage extends WebviewMessage {
    type: 'dropImages';
    images: DroppedImage[];
}

export interface DroppedImage {
    data: string;
    mediaType: string;
    name?: string;
}

export interface EnhancePromptMessage extends WebviewMessage {
    type: 'enhancePrompt';
    prompt: string;
}

export function isWebviewMessage(message: unknown): message is WebviewMessage {
    return typeof message === 'object' && message !== null && 'type' in message;
}

export function createNewTaskMessage(text: string, images?: string[], mode?: string): NewTaskMessage {
    return { type: 'newTask', text, images, mode };
}

export function createAskResponse(
    response: 'yesButtonClicked' | 'noButtonClicked' | 'messageResponse',
    text?: string,
    images?: string[]
): AskResponseMessage {
    return { type: 'askResponse', response, text, images };
}

export function createDropFilesMessage(paths: string[]): DropFilesMessage {
    return { type: 'dropFiles', paths };
}

export function createDropImagesMessage(images: DroppedImage[]): DropImagesMessage {
    return { type: 'dropImages', images };
}
