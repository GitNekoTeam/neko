declare module 'puppeteer-core' {
    export interface ConnectOptions {
        browserURL?: string;
        browserWSEndpoint?: string;
        defaultViewport?: { width: number; height: number } | null;
    }

    export interface GoToOptions {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' | Array<'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'>;
        timeout?: number;
        ignoreCache?: boolean;
    }

    export interface ScreenshotOptions {
        encoding?: 'base64' | 'binary';
        fullPage?: boolean;
        type?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        optimizeForSpeed?: boolean;
    }

    export interface StackFrame {
        url: string;
        lineNumber: number;
        columnNumber: number;
    }

    export interface ConsoleMessage {
        type(): string;
        text(): string;
        args(): JSHandle[];
        stackTrace(): StackFrame[] | undefined;
    }

    export interface HTTPRequest {
        url(): string;
        method(): string;
        headers(): Record<string, string>;
        postData(): string | undefined;
        resourceType(): string;
        continue(): Promise<void>;
        abort(): Promise<void>;
    }

    export interface HTTPResponse {
        url(): string;
        status(): number;
        statusText(): string;
        headers(): Record<string, string>;
        text(): Promise<string>;
        json(): Promise<unknown>;
    }

    export interface JSHandle<T = unknown> {
        jsonValue(): Promise<T>;
        dispose(): Promise<void>;
        getProperty(propertyName: string): Promise<JSHandle>;
    }

    export interface BoundingBox {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    export interface ElementHandle<T = Element> extends JSHandle<T> {
        click(options?: { clickCount?: number }): Promise<void>;
        hover(): Promise<void>;
        type(text: string): Promise<void>;
        uploadFile(...filePaths: string[]): Promise<void>;
        boundingBox(): Promise<BoundingBox | null>;
        screenshot(options?: ScreenshotOptions): Promise<string | Buffer>;
        evaluate<R>(pageFunction: (element: T, ...args: unknown[]) => R, ...args: unknown[]): Promise<R>;
        frame: Frame;
        asLocator(): Locator;
        drag(target: ElementHandle): Promise<void>;
        drop(source: ElementHandle): Promise<void>;
    }

    export interface Locator {
        click(options?: { count?: number }): Promise<void>;
        hover(): Promise<void>;
        fill(value: string): Promise<void>;
    }

    export interface Frame {
        evaluate<T>(pageFunction: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
        evaluateHandle<T>(pageFunction: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<JSHandle<T>>;
    }

    export interface Dialog {
        type(): 'alert' | 'confirm' | 'prompt' | 'beforeunload';
        message(): string;
        accept(promptText?: string): Promise<void>;
        dismiss(): Promise<void>;
    }

    export interface FileChooser {
        accept(filePaths: string[]): Promise<void>;
        cancel(): Promise<void>;
    }

    export interface SerializedAXNode {
        role?: string;
        name?: string;
        value?: string | number;
        description?: string;
        keyshortcuts?: string;
        roledescription?: string;
        valuetext?: string;
        disabled?: boolean;
        expanded?: boolean;
        focused?: boolean;
        modal?: boolean;
        multiline?: boolean;
        multiselectable?: boolean;
        readonly?: boolean;
        required?: boolean;
        selected?: boolean;
        checked?: boolean | 'mixed';
        pressed?: boolean | 'mixed';
        level?: number;
        valuemin?: number;
        valuemax?: number;
        autocomplete?: string;
        haspopup?: string;
        invalid?: string;
        orientation?: string;
        children?: SerializedAXNode[];
    }

    export interface Accessibility {
        snapshot(options?: { interestingOnly?: boolean; root?: ElementHandle }): Promise<SerializedAXNode | null>;
    }

    export interface Mouse {
        move(x: number, y: number): Promise<void>;
        down(): Promise<void>;
        up(): Promise<void>;
        click(x: number, y: number): Promise<void>;
    }

    export interface Keyboard {
        down(key: string): Promise<void>;
        up(key: string): Promise<void>;
        press(key: string): Promise<void>;
        type(text: string): Promise<void>;
    }

    export interface Tracing {
        start(options?: { categories?: string[]; path?: string }): Promise<void>;
        stop(): Promise<Buffer | undefined>;
    }

    export interface NetworkConditions {
        download: number;
        upload: number;
        latency: number;
        offline?: boolean;
    }

    export interface Viewport {
        width: number;
        height: number;
        deviceScaleFactor?: number;
        isMobile?: boolean;
        hasTouch?: boolean;
        isLandscape?: boolean;
    }

    export interface Target {
        type(): string;
        url(): string;
        page(): Promise<Page | null>;
        _targetId: string;
    }

    export interface Page {
        target(): Target;
        url(): string;
        title(): Promise<string>;
        content(): Promise<string>;
        goto(url: string, options?: GoToOptions): Promise<HTTPResponse | null>;
        goBack(options?: GoToOptions): Promise<HTTPResponse | null>;
        goForward(options?: GoToOptions): Promise<HTTPResponse | null>;
        reload(options?: GoToOptions): Promise<HTTPResponse | null>;
        screenshot(options?: ScreenshotOptions): Promise<string | Buffer>;
        evaluate<T>(pageFunction: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
        evaluateHandle<T>(pageFunction: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<JSHandle<T>>;
        $(selector: string): Promise<ElementHandle | null>;
        $$(selector: string): Promise<ElementHandle[]>;
        $eval<R>(selector: string, pageFunction: (element: Element, ...args: unknown[]) => R, ...args: unknown[]): Promise<R>;
        click(selector: string, options?: { clickCount?: number }): Promise<void>;
        hover(selector: string): Promise<void>;
        type(selector: string, text: string): Promise<void>;
        waitForSelector(selector: string, options?: { timeout?: number }): Promise<ElementHandle | null>;
        waitForFunction<T>(pageFunction: string | ((...args: unknown[]) => T), options?: { timeout?: number }, ...args: unknown[]): Promise<JSHandle<T>>;
        waitForFileChooser(options?: { timeout?: number }): Promise<FileChooser>;
        setViewport(viewport: Viewport): Promise<void>;
        setGeolocation(geolocation: { latitude: number; longitude: number; accuracy?: number }): Promise<void>;
        emulateNetworkConditions(conditions: NetworkConditions | null): Promise<void>;
        emulateCPUThrottling(factor: number): Promise<void>;
        bringToFront(): Promise<void>;
        close(): Promise<void>;
        mouse: Mouse;
        keyboard: Keyboard;
        accessibility: Accessibility;
        tracing: Tracing;
        on(event: 'console', handler: (msg: ConsoleMessage) => void): void;
        on(event: 'request', handler: (request: HTTPRequest) => void): void;
        on(event: 'response', handler: (response: HTTPResponse) => void): void;
        on(event: 'dialog', handler: (dialog: Dialog) => void): void;
        on(event: 'framenavigated', handler: () => void): void;
        on(event: string, handler: (...args: unknown[]) => void): void;
    }

    export interface Browser {
        pages(): Promise<Page[]>;
        newPage(): Promise<Page>;
        close(): Promise<void>;
        disconnect(): Promise<void>;
        on(event: 'targetcreated', handler: (target: Target) => void): void;
        on(event: 'targetdestroyed', handler: (target: Target) => void): void;
        on(event: string, handler: (...args: unknown[]) => void): void;
    }

    export function connect(options: ConnectOptions): Promise<Browser>;
    export function launch(options?: unknown): Promise<Browser>;
}

declare global {
    interface Element {
        value?: string;
    }
    interface HTMLInputElement extends Element {
        value: string;
    }
    interface HTMLTextAreaElement extends Element {
        value: string;
    }
    interface HTMLSelectElement extends Element {
        value: string;
    }
}
