import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolInput, ToolResult } from './BaseTool';
import { BrowserService, ConsoleMessageType, ResourceType } from '../../services/browser/BrowserService';

// Screenshot Tool
export class BrowserScreenshotTool extends BaseTool {
    name = 'take_screenshot';
    description = 'Take a screenshot of the page or element';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: 'Image format (default: png)' },
                    quality: { type: 'number', description: 'Quality for JPEG/WebP (0-100)' },
                    uid: { type: 'string', description: 'Element uid from snapshot to screenshot' },
                    fullPage: { type: 'boolean', description: 'Capture full page instead of viewport' },
                    pageId: { type: 'string', description: 'Optional page ID' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const screenshot = await this.browserService.takeScreenshot({
                pageId: input.pageId as string,
                format: input.format as 'png' | 'jpeg' | 'webp',
                quality: input.quality as number,
                fullPage: input.fullPage as boolean,
                uid: input.uid as string
            });

            if (!screenshot) {
                return this.failure('Failed to take screenshot. Is the browser connected?');
            }

            const format = (input.format as string) || 'png';
            return this.success('Screenshot captured', { screenshot: `data:image/${format};base64,${screenshot}` });
        } catch (error) {
            return this.failure(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Snapshot Tool (A11y Tree)
export class BrowserSnapshotTool extends BaseTool {
    name = 'take_snapshot';
    description = 'Take a text snapshot of the page based on the accessibility tree. Lists elements with unique identifiers (uid).';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    verbose: { type: 'boolean', description: 'Include all a11y tree information' },
                    pageId: { type: 'string', description: 'Optional page ID' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const snapshot = await this.browserService.takeSnapshot({
                verbose: input.verbose as boolean,
                pageId: input.pageId as string
            });

            if (!snapshot) {
                return this.failure('Failed to take snapshot. Is the browser connected?');
            }

            const formatNode = (node: typeof snapshot, indent = 0): string => {
                const prefix = '  '.repeat(indent);
                let result = `${prefix}[${node.uid}] ${node.role}: ${node.name}`;
                if (node.value) result += ` = "${node.value}"`;
                result += '\n';
                for (const child of node.children) {
                    result += formatNode(child, indent + 1);
                }
                return result;
            };

            return this.success(formatNode(snapshot), { snapshot });
        } catch (error) {
            return this.failure(`Snapshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Wait For Tool
export class BrowserWaitForTool extends BaseTool {
    name = 'wait_for';
    description = 'Wait for specified text to appear on the page';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Text to wait for' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
                },
                required: ['text']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const found = await this.browserService.waitForText(
                input.text as string,
                input.timeout as number
            );

            if (found) {
                return this.success(`Text "${input.text}" found on page`);
            }
            return this.failure(`Timeout waiting for text "${input.text}"`);
        } catch (error) {
            return this.failure(`Wait failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Console Tools
export class BrowserListConsoleTool extends BaseTool {
    name = 'list_console_messages';
    description = 'List console messages from the browser';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    pageSize: { type: 'number', description: 'Max messages per page' },
                    pageIdx: { type: 'number', description: 'Page number (0-based)' },
                    types: { type: 'array', items: { type: 'string' }, description: 'Filter by message types' },
                    includePreservedMessages: { type: 'boolean', description: 'Include messages from previous navigations' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const result = this.browserService.getConsoleMessages({
                pageSize: input.pageSize as number,
                pageIdx: input.pageIdx as number,
                types: input.types as ConsoleMessageType[],
                includePreserved: input.includePreservedMessages as boolean
            });

            if (result.messages.length === 0) {
                return this.success('No console messages');
            }

            let output = `Console messages (${result.total} total, page ${result.page + 1}/${result.totalPages}):\n\n`;
            for (const msg of result.messages) {
                output += `[${msg.id}] [${msg.type}] ${msg.text}\n`;
            }

            return this.success(output, { ...result });
        } catch (error) {
            return this.failure(`Failed to get console: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserGetConsoleTool extends BaseTool {
    name = 'get_console_message';
    description = 'Get a specific console message by ID';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    msgid: { type: 'number', description: 'Message ID' }
                },
                required: ['msgid']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const message = this.browserService.getConsoleMessageById(input.msgid as number);
        if (!message) {
            return this.failure(`Message with ID ${input.msgid} not found`);
        }

        let output = `[${message.type}] ${message.text}`;
        if (message.stackTrace) {
            output += `\nStack trace:\n${message.stackTrace}`;
        }

        return this.success(output, { message });
    }
}

// Network Tools
export class BrowserListNetworkTool extends BaseTool {
    name = 'list_network_requests';
    description = 'List network requests from the browser';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    pageSize: { type: 'number', description: 'Max requests per page' },
                    pageIdx: { type: 'number', description: 'Page number (0-based)' },
                    resourceTypes: { type: 'array', items: { type: 'string' }, description: 'Filter by resource types' },
                    includePreservedRequests: { type: 'boolean', description: 'Include requests from previous navigations' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const result = this.browserService.getNetworkRequests({
                pageSize: input.pageSize as number,
                pageIdx: input.pageIdx as number,
                resourceTypes: input.resourceTypes as ResourceType[],
                includePreserved: input.includePreservedRequests as boolean
            });

            if (result.requests.length === 0) {
                return this.success('No network requests');
            }

            let output = `Network requests (${result.total} total, page ${result.page + 1}/${result.totalPages}):\n\n`;
            for (const req of result.requests) {
                output += `[${req.id}] ${req.method} ${req.url} (${req.status || 'pending'}) [${req.resourceType}]\n`;
            }

            return this.success(output, { ...result });
        } catch (error) {
            return this.failure(`Failed to get network: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserGetNetworkTool extends BaseTool {
    name = 'get_network_request';
    description = 'Get a specific network request by ID';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    reqid: { type: 'number', description: 'Request ID' }
                },
                required: ['reqid']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const request = this.browserService.getNetworkRequestById(input.reqid as number);
        if (!request) {
            return this.failure(`Request with ID ${input.reqid} not found`);
        }

        let output = `${request.method} ${request.url}\nStatus: ${request.status || 'pending'} ${request.statusText || ''}\nType: ${request.resourceType}`;
        if (request.timing?.duration) {
            output += `\nDuration: ${request.timing.duration}ms`;
        }

        return this.success(output, { request });
    }
}

// Page Tools
export class BrowserListPagesTool extends BaseTool {
    name = 'list_pages';
    description = 'Get a list of pages open in the browser';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: { type: 'object', properties: {} }
        };
    }

    async execute(): Promise<ToolResult> {
        try {
            const pages = await this.browserService.getPages();
            if (pages.length === 0) {
                return this.success('No pages open');
            }

            let output = `Open pages (${pages.length}):\n\n`;
            for (const page of pages) {
                const selected = page.isSelected ? ' [SELECTED]' : '';
                output += `[${page.index}] ${page.title}${selected}\n    ${page.url}\n`;
            }

            return this.success(output, { pages });
        } catch (error) {
            return this.failure(`Failed to list pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserSelectPageTool extends BaseTool {
    name = 'select_page';
    description = 'Select a page as context for future tool calls';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    pageIdx: { type: 'number', description: 'Page index from list_pages' }
                },
                required: ['pageIdx']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const success = this.browserService.selectPageByIndex(input.pageIdx as number);
        if (success) {
            return this.success(`Selected page ${input.pageIdx}`);
        }
        return this.failure(`Invalid page index: ${input.pageIdx}`);
    }
}

export class BrowserNewPageTool extends BaseTool {
    name = 'new_page';
    description = 'Create a new page';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to load in new page' }
                },
                required: ['url']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const page = await this.browserService.newPage(input.url as string);
            if (page) {
                return this.success(`Created new page: ${page.title}`, { page });
            }
            return this.failure('Failed to create new page');
        } catch (error) {
            return this.failure(`Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserClosePageTool extends BaseTool {
    name = 'close_page';
    description = 'Close a page by index (cannot close last page)';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    pageIdx: { type: 'number', description: 'Page index to close' }
                },
                required: ['pageIdx']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.closePageByIndex(input.pageIdx as number);
            return this.success(`Closed page ${input.pageIdx}`);
        } catch (error) {
            return this.failure(`Failed to close page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserNavigateTool extends BaseTool {
    name = 'navigate_page';
    description = 'Navigate the selected page';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['url', 'back', 'forward', 'reload'], description: 'Navigation type' },
                    url: { type: 'string', description: 'Target URL (for type=url)' },
                    ignoreCache: { type: 'boolean', description: 'Ignore cache on reload' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const navType = (input.type as string) || (input.url ? 'url' : undefined);
            if (!navType) {
                return this.failure('Either URL or navigation type is required');
            }

            switch (navType) {
                case 'url':
                    if (!input.url) return this.failure('URL is required for type=url');
                    await this.browserService.navigate(input.url as string, undefined, input.timeout as number);
                    return this.success(`Navigated to ${input.url}`);
                case 'back':
                    await this.browserService.goBack(undefined, input.timeout as number);
                    return this.success('Navigated back');
                case 'forward':
                    await this.browserService.goForward(undefined, input.timeout as number);
                    return this.success('Navigated forward');
                case 'reload':
                    await this.browserService.reload(undefined, input.ignoreCache as boolean);
                    return this.success('Page reloaded');
                default:
                    return this.failure(`Unknown navigation type: ${navType}`);
            }
        } catch (error) {
            return this.failure(`Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserResizePageTool extends BaseTool {
    name = 'resize_page';
    description = 'Resize the selected page viewport';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    width: { type: 'number', description: 'Page width' },
                    height: { type: 'number', description: 'Page height' }
                },
                required: ['width', 'height']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.resizePage(input.width as number, input.height as number);
            return this.success(`Resized page to ${input.width}x${input.height}`);
        } catch (error) {
            return this.failure(`Resize failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Input Tools
export class BrowserClickTool extends BaseTool {
    name = 'click';
    description = 'Click on an element by uid from snapshot';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    uid: { type: 'string', description: 'Element uid from snapshot' },
                    selector: { type: 'string', description: 'CSS selector (alternative to uid)' },
                    dblClick: { type: 'boolean', description: 'Double click' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            if (input.uid) {
                await this.browserService.clickByUid(input.uid as string, input.dblClick as boolean);
            } else if (input.selector) {
                await this.browserService.click(input.selector as string, undefined, input.dblClick as boolean);
            } else {
                return this.failure('Either uid or selector is required');
            }
            return this.success(input.dblClick ? 'Double clicked element' : 'Clicked element');
        } catch (error) {
            return this.failure(`Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserHoverTool extends BaseTool {
    name = 'hover';
    description = 'Hover over an element';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    uid: { type: 'string', description: 'Element uid from snapshot' },
                    selector: { type: 'string', description: 'CSS selector (alternative to uid)' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            if (input.uid) {
                await this.browserService.hoverByUid(input.uid as string);
            } else if (input.selector) {
                await this.browserService.hover(input.selector as string);
            } else {
                return this.failure('Either uid or selector is required');
            }
            return this.success('Hovered over element');
        } catch (error) {
            return this.failure(`Hover failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserFillTool extends BaseTool {
    name = 'fill';
    description = 'Fill a form input, textarea, or select element';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    uid: { type: 'string', description: 'Element uid from snapshot' },
                    selector: { type: 'string', description: 'CSS selector (alternative to uid)' },
                    value: { type: 'string', description: 'Value to fill' }
                },
                required: ['value']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            if (input.uid) {
                await this.browserService.fillByUid(input.uid as string, input.value as string);
            } else if (input.selector) {
                await this.browserService.fill(input.selector as string, input.value as string);
            } else {
                return this.failure('Either uid or selector is required');
            }
            return this.success('Filled element');
        } catch (error) {
            return this.failure(`Fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserFillFormTool extends BaseTool {
    name = 'fill_form';
    description = 'Fill multiple form elements at once';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    elements: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                uid: { type: 'string', description: 'Element uid' },
                                value: { type: 'string', description: 'Value to fill' }
                            },
                            required: ['uid', 'value']
                        },
                        description: 'Elements to fill'
                    }
                },
                required: ['elements']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const elements = input.elements as Array<{ uid: string; value: string }>;
            await this.browserService.fillForm(elements);
            return this.success(`Filled ${elements.length} form elements`);
        } catch (error) {
            return this.failure(`Fill form failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserDragTool extends BaseTool {
    name = 'drag';
    description = 'Drag an element onto another element';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    from_uid: { type: 'string', description: 'Element uid to drag' },
                    to_uid: { type: 'string', description: 'Element uid to drop into' }
                },
                required: ['from_uid', 'to_uid']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.drag(input.from_uid as string, input.to_uid as string);
            return this.success('Dragged element');
        } catch (error) {
            return this.failure(`Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserUploadFileTool extends BaseTool {
    name = 'upload_file';
    description = 'Upload a file through a file input element';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    uid: { type: 'string', description: 'File input element uid' },
                    selector: { type: 'string', description: 'CSS selector (alternative to uid)' },
                    filePath: { type: 'string', description: 'Local file path to upload' }
                },
                required: ['filePath']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            if (input.uid) {
                await this.browserService.uploadFileByUid(input.uid as string, input.filePath as string);
            } else if (input.selector) {
                await this.browserService.uploadFile(input.selector as string, input.filePath as string);
            } else {
                return this.failure('Either uid or selector is required');
            }
            return this.success(`Uploaded file: ${input.filePath}`);
        } catch (error) {
            return this.failure(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserPressKeyTool extends BaseTool {
    name = 'press_key';
    description = 'Press a key or key combination (e.g., "Enter", "Control+A")';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Key or combination (e.g., "Enter", "Control+Shift+R")' }
                },
                required: ['key']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.pressKey(input.key as string);
            return this.success(`Pressed key: ${input.key}`);
        } catch (error) {
            return this.failure(`Key press failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Dialog Tool
export class BrowserHandleDialogTool extends BaseTool {
    name = 'handle_dialog';
    description = 'Handle a browser dialog (alert, confirm, prompt)';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['accept', 'dismiss'], description: 'Accept or dismiss the dialog' },
                    promptText: { type: 'string', description: 'Text to enter for prompt dialogs' }
                },
                required: ['action']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        const dialog = this.browserService.getDialog();
        if (!dialog) {
            return this.failure('No open dialog found');
        }

        try {
            const success = await this.browserService.handleDialog(
                input.action as 'accept' | 'dismiss',
                input.promptText as string
            );
            if (success) {
                return this.success(`${input.action === 'accept' ? 'Accepted' : 'Dismissed'} dialog`);
            }
            return this.failure('Failed to handle dialog');
        } catch (error) {
            return this.failure(`Dialog handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Script Tool
export class BrowserEvaluateScriptTool extends BaseTool {
    name = 'evaluate_script';
    description = 'Execute JavaScript in the page context';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    function: { type: 'string', description: 'JavaScript function to execute' },
                    args: {
                        type: 'array',
                        items: { type: 'object', properties: { uid: { type: 'string' } } },
                        description: 'Element arguments by uid'
                    }
                },
                required: ['function']
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            const result = await this.browserService.evaluateFunction(
                input.function as string,
                input.args as Array<{ uid: string }>
            );
            return this.success(`Script executed.\nResult: ${JSON.stringify(result, null, 2)}`, { result });
        } catch (error) {
            return this.failure(`Script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Emulation Tool
export class BrowserEmulateTool extends BaseTool {
    name = 'emulate';
    description = 'Emulate network conditions, CPU throttling, or geolocation';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    networkConditions: {
                        type: 'string',
                        enum: ['No emulation', 'Offline', 'Slow 3G', 'Fast 3G', '4G'],
                        description: 'Network throttling preset'
                    },
                    cpuThrottlingRate: { type: 'number', description: 'CPU slowdown factor (1-20, 1 = no throttling)' },
                    geolocation: {
                        type: 'object',
                        properties: {
                            latitude: { type: 'number' },
                            longitude: { type: 'number' }
                        },
                        description: 'Geolocation to emulate (null to clear)'
                    }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.emulate({
                networkConditions: input.networkConditions as string,
                cpuThrottlingRate: input.cpuThrottlingRate as number,
                geolocation: input.geolocation as { latitude: number; longitude: number } | null
            });

            const settings: string[] = [];
            if (input.networkConditions) settings.push(`Network: ${input.networkConditions}`);
            if (input.cpuThrottlingRate) settings.push(`CPU: ${input.cpuThrottlingRate}x`);
            if (input.geolocation) settings.push(`Geo: ${JSON.stringify(input.geolocation)}`);

            return this.success(`Emulation updated: ${settings.join(', ') || 'No changes'}`);
        } catch (error) {
            return this.failure(`Emulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Performance Tools
export class BrowserStartTraceTool extends BaseTool {
    name = 'performance_start_trace';
    description = 'Start a performance trace recording';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: {
                type: 'object',
                properties: {
                    reload: { type: 'boolean', description: 'Reload page after starting trace' },
                    autoStop: { type: 'boolean', description: 'Auto-stop after 5 seconds' }
                }
            }
        };
    }

    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            await this.browserService.startPerformanceTrace({
                reload: input.reload as boolean,
                autoStop: input.autoStop as boolean
            });

            if (input.autoStop) {
                return this.success('Performance trace completed');
            }
            return this.success('Performance trace started. Use performance_stop_trace to stop.');
        } catch (error) {
            return this.failure(`Trace failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class BrowserStopTraceTool extends BaseTool {
    name = 'performance_stop_trace';
    description = 'Stop the active performance trace';

    private browserService: BrowserService;

    constructor(outputChannel: vscode.OutputChannel, browserService: BrowserService) {
        super(outputChannel);
        this.browserService = browserService;
    }

    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: { type: 'object', properties: {} }
        };
    }

    async execute(): Promise<ToolResult> {
        try {
            const trace = await this.browserService.stopPerformanceTrace();
            if (trace) {
                return this.success(`Performance trace stopped. ${trace.events.length} events recorded.`, { trace });
            }
            return this.failure('No active trace to stop');
        } catch (error) {
            return this.failure(`Stop trace failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Export all browser tools for registration
export function createBrowserTools(outputChannel: vscode.OutputChannel, browserService: BrowserService): BaseTool[] {
    return [
        // Screenshot & Snapshot
        new BrowserScreenshotTool(outputChannel, browserService),
        new BrowserSnapshotTool(outputChannel, browserService),
        new BrowserWaitForTool(outputChannel, browserService),
        // Console
        new BrowserListConsoleTool(outputChannel, browserService),
        new BrowserGetConsoleTool(outputChannel, browserService),
        // Network
        new BrowserListNetworkTool(outputChannel, browserService),
        new BrowserGetNetworkTool(outputChannel, browserService),
        // Pages
        new BrowserListPagesTool(outputChannel, browserService),
        new BrowserSelectPageTool(outputChannel, browserService),
        new BrowserNewPageTool(outputChannel, browserService),
        new BrowserClosePageTool(outputChannel, browserService),
        new BrowserNavigateTool(outputChannel, browserService),
        new BrowserResizePageTool(outputChannel, browserService),
        // Input
        new BrowserClickTool(outputChannel, browserService),
        new BrowserHoverTool(outputChannel, browserService),
        new BrowserFillTool(outputChannel, browserService),
        new BrowserFillFormTool(outputChannel, browserService),
        new BrowserDragTool(outputChannel, browserService),
        new BrowserUploadFileTool(outputChannel, browserService),
        new BrowserPressKeyTool(outputChannel, browserService),
        // Dialog
        new BrowserHandleDialogTool(outputChannel, browserService),
        // Script
        new BrowserEvaluateScriptTool(outputChannel, browserService),
        // Emulation
        new BrowserEmulateTool(outputChannel, browserService),
        // Performance
        new BrowserStartTraceTool(outputChannel, browserService),
        new BrowserStopTraceTool(outputChannel, browserService)
    ];
}
