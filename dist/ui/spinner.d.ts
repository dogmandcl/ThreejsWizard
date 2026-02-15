export declare class Spinner {
    private spinner;
    start(text: string): void;
    update(text: string): void;
    succeed(text?: string): void;
    fail(text?: string): void;
    stop(): void;
    info(text: string): void;
}
export declare const spinner: Spinner;
