import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer-core';

export type ConsoleMessageType = 'log' | 'debug' | 'info' | 'error' | 'warn' | 'dir' | 'dirxml' | 'table' | 'trace' | 'clear' | 'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd' | 'verbose';

export type ResourceType = 'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'prefetch' | 'eventsource' | 'websocket' | 'manifest' | 'signedexchange' | 'ping' | 'cspviolationreport' | 'preflight' | 'other';

export interface PageInfo {
    id: string;
    url: string;
    title: string;
    index: number;
    isSelected: boolean;
}

export interface ConsoleMessage {
    id: number;
    type: ConsoleMessageType;
    text: string;
    timestamp: number;
    args?: string[];
    stackTrace?: string;
}

export interface NetworkRequest {
    id: number;
    url: string;
    method: string;
    status?: number;
    statusText?: string;
    resourceType: string;
    timestamp: number;
    responseHeaders?: Record<string, string>;
    requestHeaders?: Record<string, string>;
    responseBody?: string;
    timing?: {
        startTime: number;
        endTime?: number;
        duration?: number;
    };
}

export interface SnapshotNode {
    uid: string;
    role: string;
    name: string;
    value?: string;
    children: SnapshotNode[];
}

export interface DialogInfo {
    type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
    message: string;
}

export interface EmulationSettings {
    networkConditions?: string | null;
    cpuThrottlingRate?: number;
    geolocation?: { latitude: number; longitude: number } | null;
}

export interface PerformanceTrace {
    events: unknown[];
    startTime: number;
    endTime?: number;
}

export class BrowserService implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private debugPort: number;
    private browser: puppeteer.Browser | undefined;
    private pages: Map<string, puppeteer.Page> = new Map();
    private selectedPageId: string | undefined;
    private consoleMessages: ConsoleMessage[] = [];
    private preservedConsoleMessages: ConsoleMessage[][] = [];
    private networkRequests: NetworkRequest[] = [];
    private preservedNetworkRequests: NetworkRequest[][] = [];
    private panel: vscode.WebviewPanel | undefined;
    private currentDialog: puppeteer.Dialog | undefined;
    private dialogInfo: DialogInfo | undefined;
    private emulationSettings: EmulationSettings = {};
    private isTracingActive = false;
    private performanceTraces: PerformanceTrace[] = [];
    private messageIdCounter = 0;
    private requestIdCounter = 0;
    private uidMap: Map<string, puppeteer.ElementHandle> = new Map();

    constructor(outputChannel: vscode.OutputChannel, debugPort: number) {
        this.outputChannel = outputChannel;
        this.debugPort = debugPort;
    }

    async connect(): Promise<boolean> {
        try {
            this.browser = await puppeteer.connect({
                browserURL: `http://localhost:${this.debugPort}`,
                defaultViewport: null
            });
            this.outputChannel.appendLine(`Connected to browser on port ${this.debugPort}`);
            await this.setupPageListeners();
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to connect to browser: ${error}`);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.browser) {
            await this.browser.disconnect();
            this.browser = undefined;
            this.pages.clear();
            this.selectedPageId = undefined;
        }
    }

    private async setupPageListeners(): Promise<void> {
        if (!this.browser) return;

        const pages = await this.browser.pages();
        for (const page of pages) {
            await this.attachToPage(page);
        }

        if (pages.length > 0) {
            this.selectedPageId = pages[0].target()._targetId;
        }

        this.browser.on('targetcreated', async (target: puppeteer.Target) => {
            if (target.type() === 'page') {
                const page = await target.page();
                if (page) {
                    await this.attachToPage(page);
                }
            }
        });

        this.browser.on('targetdestroyed', (target: puppeteer.Target) => {
            const targetId = target._targetId;
            this.pages.delete(targetId);
            if (this.selectedPageId === targetId) {
                const firstPage = this.pages.keys().next().value;
                this.selectedPageId = firstPage;
            }
        });
    }

    private async attachToPage(page: puppeteer.Page): Promise<void> {
        const pageId = page.target()._targetId;
        this.pages.set(pageId, page);

        page.on('console', (msg: puppeteer.ConsoleMessage) => {
            const message: ConsoleMessage = {
                id: ++this.messageIdCounter,
                type: msg.type() as ConsoleMessageType,
                text: msg.text(),
                timestamp: Date.now(),
                args: msg.args().map(arg => arg.toString()),
                stackTrace: msg.stackTrace()?.map(frame => 
                    `${frame.url}:${frame.lineNumber}:${frame.columnNumber}`
                ).join('\n')
            };
            this.consoleMessages.push(message);
            if (this.consoleMessages.length > 1000) {
                this.consoleMessages.shift();
            }
        });

        page.on('request', (request: puppeteer.HTTPRequest) => {
            const req: NetworkRequest = {
                id: ++this.requestIdCounter,
                url: request.url(),
                method: request.method(),
                resourceType: request.resourceType(),
                timestamp: Date.now(),
                requestHeaders: request.headers(),
                timing: { startTime: Date.now() }
            };
            this.networkRequests.push(req);
        });

        page.on('response', async (response: puppeteer.HTTPResponse) => {
            const request = this.networkRequests.find(
                r => r.url === response.url() && !r.status
            );
            if (request) {
                request.status = response.status();
                request.statusText = response.statusText();
                request.responseHeaders = response.headers();
                if (request.timing) {
                    request.timing.endTime = Date.now();
                    request.timing.duration = request.timing.endTime - request.timing.startTime;
                }
            }
        });

        page.on('dialog', (dialog: puppeteer.Dialog) => {
            this.currentDialog = dialog;
            this.dialogInfo = {
                type: dialog.type() as DialogInfo['type'],
                message: dialog.message()
            };
        });

        page.on('framenavigated', () => {
            this.preserveCurrentData();
            this.consoleMessages = [];
            this.networkRequests = [];
            this.uidMap.clear();
        });
    }

    private preserveCurrentData(): void {
        if (this.consoleMessages.length > 0) {
            this.preservedConsoleMessages.push([...this.consoleMessages]);
            if (this.preservedConsoleMessages.length > 3) {
                this.preservedConsoleMessages.shift();
            }
        }
        if (this.networkRequests.length > 0) {
            this.preservedNetworkRequests.push([...this.networkRequests]);
            if (this.preservedNetworkRequests.length > 3) {
                this.preservedNetworkRequests.shift();
            }
        }
    }

    // Page Management
    async getPages(): Promise<PageInfo[]> {
        if (!this.browser) return [];

        const pages = await this.browser.pages();
        return Promise.all(pages.map(async (page: puppeteer.Page, index: number) => ({
            id: page.target()._targetId,
            url: page.url(),
            title: await page.title(),
            index,
            isSelected: page.target()._targetId === this.selectedPageId
        })));
    }

    selectPage(pageId: string): boolean {
        if (this.pages.has(pageId)) {
            this.selectedPageId = pageId;
            return true;
        }
        return false;
    }

    selectPageByIndex(index: number): boolean {
        const pageIds = Array.from(this.pages.keys());
        if (index >= 0 && index < pageIds.length) {
            this.selectedPageId = pageIds[index];
            return true;
        }
        return false;
    }

    getSelectedPage(): puppeteer.Page | undefined {
        if (this.selectedPageId) {
            return this.pages.get(this.selectedPageId);
        }
        return this.pages.values().next().value;
    }

    async newPage(url?: string): Promise<PageInfo | undefined> {
        if (!this.browser) return undefined;

        const page = await this.browser.newPage();
        await this.attachToPage(page);
        const pageId = page.target()._targetId;
        this.selectedPageId = pageId;

        if (url) {
            await page.goto(url, { waitUntil: 'networkidle2' });
        }

        return {
            id: pageId,
            url: page.url(),
            title: await page.title(),
            index: this.pages.size - 1,
            isSelected: true
        };
    }

    async closePage(pageId?: string): Promise<boolean> {
        const targetId = pageId || this.selectedPageId;
        if (!targetId) return false;

        if (this.pages.size <= 1) {
            throw new Error('Cannot close the last page');
        }

        const page = this.pages.get(targetId);
        if (page) {
            await page.close();
            this.pages.delete(targetId);
            if (this.selectedPageId === targetId) {
                this.selectedPageId = this.pages.keys().next().value;
            }
            return true;
        }
        return false;
    }

    async closePageByIndex(index: number): Promise<boolean> {
        const pageIds = Array.from(this.pages.keys());
        if (index >= 0 && index < pageIds.length) {
            return this.closePage(pageIds[index]);
        }
        return false;
    }

    // Navigation
    async navigate(url: string, pageId?: string, timeout?: number): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout || 30000 });
    }

    async goBack(pageId?: string, timeout?: number): Promise<boolean> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const response = await page.goBack({ timeout: timeout || 30000 });
        return response !== null;
    }

    async goForward(pageId?: string, timeout?: number): Promise<boolean> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const response = await page.goForward({ timeout: timeout || 30000 });
        return response !== null;
    }

    async reload(pageId?: string, ignoreCache?: boolean): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        if (ignoreCache) {
            await page.reload({ waitUntil: 'networkidle2' });
        } else {
            await page.reload({ waitUntil: 'networkidle2' });
        }
    }

    async resizePage(width: number, height: number, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.setViewport({ width, height });
    }

    // Input Tools
    async click(selector: string, pageId?: string, dblClick?: boolean): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.click(selector, { clickCount: dblClick ? 2 : 1 });
    }

    async clickByUid(uid: string, dblClick?: boolean): Promise<void> {
        const handle = this.uidMap.get(uid);
        if (!handle) throw new Error(`Element with uid "${uid}" not found`);

        await handle.click({ clickCount: dblClick ? 2 : 1 });
    }

    async hover(selector: string, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.hover(selector);
    }

    async hoverByUid(uid: string): Promise<void> {
        const handle = this.uidMap.get(uid);
        if (!handle) throw new Error(`Element with uid "${uid}" not found`);

        await handle.hover();
    }

    async type(selector: string, text: string, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.type(selector, text);
    }

    async fill(selector: string, value: string, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.$eval(selector, (el, val) => {
            const element = el as unknown as { value?: string; dispatchEvent: (e: Event) => void };
            if (element.value !== undefined) {
                element.value = val as string;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, value);
    }

    async fillByUid(uid: string, value: string): Promise<void> {
        const handle = this.uidMap.get(uid);
        if (!handle) throw new Error(`Element with uid "${uid}" not found`);

        await handle.evaluate((el, val) => {
            const element = el as unknown as { value?: string; dispatchEvent: (e: Event) => void };
            if (element.value !== undefined) {
                element.value = val as string;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, value);
    }

    async fillForm(elements: Array<{ uid: string; value: string }>): Promise<void> {
        for (const element of elements) {
            await this.fillByUid(element.uid, element.value);
        }
    }

    async drag(fromUid: string, toUid: string): Promise<void> {
        const fromHandle = this.uidMap.get(fromUid);
        const toHandle = this.uidMap.get(toUid);
        if (!fromHandle) throw new Error(`Element with uid "${fromUid}" not found`);
        if (!toHandle) throw new Error(`Element with uid "${toUid}" not found`);

        const fromBox = await fromHandle.boundingBox();
        const toBox = await toHandle.boundingBox();
        if (!fromBox || !toBox) throw new Error('Could not get element positions');

        const page = this.getSelectedPage();
        if (!page) throw new Error('No page available');

        await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
        await page.mouse.up();
    }

    async uploadFile(selector: string, filePath: string, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const input = await page.$(selector);
        if (!input) throw new Error(`Element "${selector}" not found`);

        await input.uploadFile(filePath);
    }

    async uploadFileByUid(uid: string, filePath: string): Promise<void> {
        const handle = this.uidMap.get(uid);
        if (!handle) throw new Error(`Element with uid "${uid}" not found`);

        await handle.uploadFile(filePath);
    }

    async pressKey(key: string, pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const parts = key.split('+');
        const mainKey = parts.pop() || key;
        const modifiers = parts;

        for (const modifier of modifiers) {
            await page.keyboard.down(modifier);
        }
        await page.keyboard.press(mainKey);
        for (const modifier of modifiers.reverse()) {
            await page.keyboard.up(modifier);
        }
    }

    // Dialog Handling
    getDialog(): DialogInfo | undefined {
        return this.dialogInfo;
    }

    async handleDialog(action: 'accept' | 'dismiss', promptText?: string): Promise<boolean> {
        if (!this.currentDialog) return false;

        try {
            if (action === 'accept') {
                await this.currentDialog.accept(promptText);
            } else {
                await this.currentDialog.dismiss();
            }
            this.currentDialog = undefined;
            this.dialogInfo = undefined;
            return true;
        } catch {
            return false;
        }
    }

    // Console Tools
    getConsoleMessages(options?: {
        limit?: number;
        types?: ConsoleMessageType[];
        includePreserved?: boolean;
        pageIdx?: number;
        pageSize?: number;
    }): { messages: ConsoleMessage[]; total: number; page: number; totalPages: number } {
        let messages = [...this.consoleMessages];

        if (options?.includePreserved) {
            for (const preserved of this.preservedConsoleMessages) {
                messages = [...preserved, ...messages];
            }
        }

        if (options?.types && options.types.length > 0) {
            messages = messages.filter(m => options.types!.includes(m.type));
        }

        const total = messages.length;
        const pageSize = options?.pageSize || options?.limit || total;
        const totalPages = Math.ceil(total / pageSize);
        const pageIdx = options?.pageIdx || 0;

        const start = pageIdx * pageSize;
        const end = start + pageSize;
        messages = messages.slice(start, end);

        return { messages, total, page: pageIdx, totalPages };
    }

    getConsoleMessageById(id: number): ConsoleMessage | undefined {
        return this.consoleMessages.find(m => m.id === id) ||
            this.preservedConsoleMessages.flat().find(m => m.id === id);
    }

    // Network Tools
    getNetworkRequests(options?: {
        limit?: number;
        resourceTypes?: ResourceType[];
        includePreserved?: boolean;
        pageIdx?: number;
        pageSize?: number;
    }): { requests: NetworkRequest[]; total: number; page: number; totalPages: number } {
        let requests = [...this.networkRequests];

        if (options?.includePreserved) {
            for (const preserved of this.preservedNetworkRequests) {
                requests = [...preserved, ...requests];
            }
        }

        if (options?.resourceTypes && options.resourceTypes.length > 0) {
            requests = requests.filter(r => options.resourceTypes!.includes(r.resourceType as ResourceType));
        }

        const total = requests.length;
        const pageSize = options?.pageSize || options?.limit || total;
        const totalPages = Math.ceil(total / pageSize);
        const pageIdx = options?.pageIdx || 0;

        const start = pageIdx * pageSize;
        const end = start + pageSize;
        requests = requests.slice(start, end);

        return { requests, total, page: pageIdx, totalPages };
    }

    getNetworkRequestById(id: number): NetworkRequest | undefined {
        return this.networkRequests.find(r => r.id === id) ||
            this.preservedNetworkRequests.flat().find(r => r.id === id);
    }

    // Screenshot Tools
    async takeScreenshot(options?: {
        pageId?: string;
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        fullPage?: boolean;
        uid?: string;
    }): Promise<string | undefined> {
        const page = options?.pageId ? this.pages.get(options.pageId) : this.getSelectedPage();
        if (!page) return undefined;

        try {
            let target: puppeteer.Page | puppeteer.ElementHandle = page;
            if (options?.uid) {
                const handle = this.uidMap.get(options.uid);
                if (!handle) throw new Error(`Element with uid "${options.uid}" not found`);
                target = handle;
            }

            const screenshot = await target.screenshot({
                encoding: 'base64',
                type: options?.format || 'png',
                quality: options?.format !== 'png' ? options?.quality : undefined,
                fullPage: options?.fullPage && !options?.uid
            });
            return screenshot as string;
        } catch (error) {
            this.outputChannel.appendLine(`Screenshot error: ${error}`);
            return undefined;
        }
    }

    // Snapshot Tools (A11y Tree)
    async takeSnapshot(options?: { verbose?: boolean; pageId?: string }): Promise<SnapshotNode | undefined> {
        const page = options?.pageId ? this.pages.get(options.pageId) : this.getSelectedPage();
        if (!page) return undefined;

        try {
            const snapshot = await page.accessibility.snapshot({ interestingOnly: !options?.verbose });
            if (!snapshot) return undefined;

            this.uidMap.clear();
            return this.processSnapshotNode(page, snapshot, '0');
        } catch (error) {
            this.outputChannel.appendLine(`Snapshot error: ${error}`);
            return undefined;
        }
    }

    private processSnapshotNode(page: puppeteer.Page, node: puppeteer.SerializedAXNode, uid: string): SnapshotNode {
        const result: SnapshotNode = {
            uid,
            role: node.role || 'unknown',
            name: node.name || '',
            value: node.value?.toString(),
            children: []
        };

        if (node.children) {
            result.children = node.children.map((child, index) =>
                this.processSnapshotNode(page, child, `${uid}-${index}`)
            );
        }

        return result;
    }

    async waitForText(text: string, timeout?: number, pageId?: string): Promise<boolean> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        try {
            await page.waitForFunction(
                `document.body.innerText.includes("${text.replace(/"/g, '\\"')}")`,
                { timeout: timeout || 30000 }
            );
            return true;
        } catch {
            return false;
        }
    }

    // Script Execution
    async executeScript(script: string, pageId?: string): Promise<unknown> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        return await page.evaluate(script);
    }

    async evaluateFunction(fn: string, args?: Array<{ uid: string }>, pageId?: string): Promise<unknown> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const handles: puppeteer.ElementHandle[] = [];
        if (args) {
            for (const arg of args) {
                const handle = this.uidMap.get(arg.uid);
                if (!handle) throw new Error(`Element with uid "${arg.uid}" not found`);
                handles.push(handle);
            }
        }

        const fnHandle = await page.evaluateHandle(`(${fn})`);
        const result = await page.evaluate(
            (evalFn: unknown, ...evalArgs: unknown[]) => (evalFn as (...a: unknown[]) => unknown)(...evalArgs),
            fnHandle,
            ...handles
        );
        await fnHandle.dispose();
        return result;
    }

    // Emulation Tools
    async emulate(settings: EmulationSettings): Promise<void> {
        const page = this.getSelectedPage();
        if (!page) throw new Error('No page available');

        if (settings.networkConditions !== undefined) {
            if (settings.networkConditions === null || settings.networkConditions === 'No emulation') {
                await page.emulateNetworkConditions(null);
            } else if (settings.networkConditions === 'Offline') {
                await page.emulateNetworkConditions({
                    offline: true,
                    download: 0,
                    upload: 0,
                    latency: 0
                });
            } else {
                const conditions = this.getNetworkConditions(settings.networkConditions);
                if (conditions) {
                    await page.emulateNetworkConditions(conditions);
                }
            }
            this.emulationSettings.networkConditions = settings.networkConditions;
        }

        if (settings.cpuThrottlingRate !== undefined) {
            await page.emulateCPUThrottling(settings.cpuThrottlingRate);
            this.emulationSettings.cpuThrottlingRate = settings.cpuThrottlingRate;
        }

        if (settings.geolocation !== undefined) {
            if (settings.geolocation === null) {
                await page.setGeolocation({ latitude: 0, longitude: 0 });
            } else {
                await page.setGeolocation(settings.geolocation);
            }
            this.emulationSettings.geolocation = settings.geolocation;
        }
    }

    private getNetworkConditions(name: string): puppeteer.NetworkConditions | null {
        const conditions: Record<string, puppeteer.NetworkConditions> = {
            'Slow 3G': { download: 500 * 1024 / 8, upload: 500 * 1024 / 8, latency: 400, offline: false },
            'Fast 3G': { download: 1.6 * 1024 * 1024 / 8, upload: 750 * 1024 / 8, latency: 150, offline: false },
            '4G': { download: 4 * 1024 * 1024 / 8, upload: 3 * 1024 * 1024 / 8, latency: 20, offline: false }
        };
        return conditions[name] || null;
    }

    getEmulationSettings(): EmulationSettings {
        return { ...this.emulationSettings };
    }

    // Performance Tools
    async startPerformanceTrace(options?: { reload?: boolean; autoStop?: boolean }): Promise<boolean> {
        if (this.isTracingActive) {
            throw new Error('A performance trace is already running');
        }

        const page = this.getSelectedPage();
        if (!page) throw new Error('No page available');

        const pageUrl = page.url();

        if (options?.reload) {
            await page.goto('about:blank', { waitUntil: 'networkidle0' });
        }

        const categories = [
            '-*',
            'blink.console',
            'blink.user_timing',
            'devtools.timeline',
            'disabled-by-default-devtools.screenshot',
            'disabled-by-default-devtools.timeline',
            'disabled-by-default-devtools.timeline.invalidationTracking',
            'disabled-by-default-devtools.timeline.frame',
            'disabled-by-default-devtools.timeline.stack',
            'disabled-by-default-v8.cpu_profiler',
            'latencyInfo',
            'loading',
            'v8.execute',
            'v8'
        ];

        await page.tracing.start({ categories });
        this.isTracingActive = true;

        if (options?.reload) {
            await page.goto(pageUrl, { waitUntil: 'load' });
        }

        if (options?.autoStop) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.stopPerformanceTrace();
        }

        return true;
    }

    async stopPerformanceTrace(): Promise<PerformanceTrace | undefined> {
        if (!this.isTracingActive) return undefined;

        const page = this.getSelectedPage();
        if (!page) return undefined;

        try {
            const buffer = await page.tracing.stop();
            this.isTracingActive = false;

            if (buffer) {
                const events = JSON.parse(buffer.toString());
                const trace: PerformanceTrace = {
                    events,
                    startTime: Date.now(),
                    endTime: Date.now()
                };
                this.performanceTraces.push(trace);
                return trace;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Performance trace error: ${error}`);
            this.isTracingActive = false;
        }
        return undefined;
    }

    isPerformanceTraceRunning(): boolean {
        return this.isTracingActive;
    }

    getPerformanceTraces(): PerformanceTrace[] {
        return [...this.performanceTraces];
    }

    // Page Content
    async getPageContent(pageId?: string): Promise<string | undefined> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (!page) return undefined;

        try {
            return await page.content();
        } catch (error) {
            this.outputChannel.appendLine(`Get content error: ${error}`);
            return undefined;
        }
    }

    // Utility Methods
    clearLogs(): void {
        this.consoleMessages = [];
        this.networkRequests = [];
        this.preservedConsoleMessages = [];
        this.preservedNetworkRequests = [];
    }

    async bringToFront(pageId?: string): Promise<void> {
        const page = pageId ? this.pages.get(pageId) : this.getSelectedPage();
        if (page) {
            await page.bringToFront();
        }
    }

    // Browser Panel UI
    async openBrowserPanel(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'neko-ai.browser',
            'Neko Browser',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getBrowserPanelHtml();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handlePanelMessage(message);
        });
    }

    private async handlePanelMessage(message: { command: string; [key: string]: unknown }): Promise<void> {
        switch (message.command) {
            case 'connect':
                await this.connect();
                break;
            case 'screenshot': {
                const screenshot = await this.takeScreenshot();
                this.panel?.webview.postMessage({ type: 'screenshot', data: screenshot });
                break;
            }
            case 'navigate':
                await this.navigate(message.url as string);
                break;
            case 'execute': {
                const result = await this.executeScript(message.script as string);
                this.panel?.webview.postMessage({ type: 'result', data: result });
                break;
            }
            case 'getPages': {
                const pages = await this.getPages();
                this.panel?.webview.postMessage({ type: 'pages', data: pages });
                break;
            }
            case 'selectPage':
                this.selectPage(message.pageId as string);
                break;
            case 'getConsole': {
                const consoleData = this.getConsoleMessages({ limit: 100 });
                this.panel?.webview.postMessage({ type: 'console', data: consoleData.messages });
                break;
            }
            case 'getNetwork': {
                const networkData = this.getNetworkRequests({ limit: 100 });
                this.panel?.webview.postMessage({ type: 'network', data: networkData.requests });
                break;
            }
        }
    }

    private getBrowserPanelHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neko Browser</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 10px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        .toolbar { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        input { flex: 1; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); min-width: 200px; }
        button { padding: 8px 16px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .tabs { display: flex; gap: 5px; margin-bottom: 10px; }
        .tab { padding: 8px 16px; cursor: pointer; background: var(--vscode-tab-inactiveBackground); border: none; color: var(--vscode-tab-inactiveForeground); }
        .tab.active { background: var(--vscode-tab-activeBackground); color: var(--vscode-tab-activeForeground); }
        .panel { display: none; }
        .panel.active { display: block; }
        .screenshot { max-width: 100%; border: 1px solid var(--vscode-panel-border); }
        .console, .network { background: var(--vscode-terminal-background); padding: 10px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; }
        .console-item, .network-item { margin: 4px 0; padding: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
        .console-error { color: var(--vscode-errorForeground); }
        .console-warn { color: var(--vscode-editorWarning-foreground); }
        .console-info { color: var(--vscode-editorInfo-foreground); }
        .pages { margin-bottom: 10px; }
        .page-item { padding: 8px; cursor: pointer; border: 1px solid var(--vscode-panel-border); margin: 4px 0; }
        .page-item.selected { background: var(--vscode-list-activeSelectionBackground); }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="connect()">Connect</button>
        <input type="text" id="url" placeholder="URL" />
        <button onclick="navigate()">Go</button>
        <button onclick="screenshot()">Screenshot</button>
        <button onclick="refresh()">Refresh</button>
    </div>
    <div class="tabs">
        <button class="tab active" onclick="showTab('preview')">Preview</button>
        <button class="tab" onclick="showTab('pages')">Pages</button>
        <button class="tab" onclick="showTab('console')">Console</button>
        <button class="tab" onclick="showTab('network')">Network</button>
    </div>
    <div id="preview" class="panel active"></div>
    <div id="pages" class="panel pages"></div>
    <div id="console" class="panel console"></div>
    <div id="network" class="panel network"></div>
    <script>
        const vscode = acquireVsCodeApi();
        function connect() { vscode.postMessage({ command: 'connect' }); }
        function navigate() { vscode.postMessage({ command: 'navigate', url: document.getElementById('url').value }); }
        function screenshot() { vscode.postMessage({ command: 'screenshot' }); }
        function refresh() { vscode.postMessage({ command: 'getPages' }); vscode.postMessage({ command: 'getConsole' }); vscode.postMessage({ command: 'getNetwork' }); }
        function showTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelector('.tab[onclick*="' + name + '"]').classList.add('active');
            document.getElementById(name).classList.add('active');
            if (name === 'pages') vscode.postMessage({ command: 'getPages' });
            if (name === 'console') vscode.postMessage({ command: 'getConsole' });
            if (name === 'network') vscode.postMessage({ command: 'getNetwork' });
        }
        function selectPage(id) { vscode.postMessage({ command: 'selectPage', pageId: id }); }
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'screenshot' && msg.data) {
                document.getElementById('preview').innerHTML = '<img class="screenshot" src="data:image/png;base64,' + msg.data + '" />';
            } else if (msg.type === 'pages') {
                document.getElementById('pages').innerHTML = msg.data.map(p => '<div class="page-item' + (p.isSelected ? ' selected' : '') + '" onclick="selectPage(\\''+p.id+'\\')"><strong>' + p.title + '</strong><br/><small>' + p.url + '</small></div>').join('');
            } else if (msg.type === 'console') {
                document.getElementById('console').innerHTML = msg.data.map(m => '<div class="console-item console-' + m.type + '">[' + m.type + '] ' + m.text + '</div>').join('');
            } else if (msg.type === 'network') {
                document.getElementById('network').innerHTML = msg.data.map(r => '<div class="network-item"><strong>' + r.method + '</strong> ' + r.url + ' <span>(' + (r.status || 'pending') + ')</span></div>').join('');
            }
        });
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.disconnect();
        this.panel?.dispose();
        for (const handle of this.uidMap.values()) {
            handle.dispose();
        }
        this.uidMap.clear();
    }
}
