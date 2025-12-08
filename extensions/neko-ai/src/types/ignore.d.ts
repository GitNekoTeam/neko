declare module 'ignore' {
    interface Ignore {
        add(pattern: string | string[]): Ignore;
        ignores(path: string): boolean;
        filter(paths: string[]): string[];
        createFilter(): (path: string) => boolean;
    }

    function ignore(): Ignore;
    export = ignore;
}
