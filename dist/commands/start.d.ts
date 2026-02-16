interface StartOptions {
    directory: string;
    model?: string;
}
export declare function startCommand(options: StartOptions): Promise<void>;
export {};
