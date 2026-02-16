import { ModelId } from '../core/types.js';
export interface SelectOption {
    label: string;
    value: string;
}
export declare class TerminalUI {
    private rl;
    private isStreaming;
    private thinkingSpinner;
    constructor();
    startThinking(message?: string): void;
    stopThinking(): void;
    confirm(message: string): Promise<boolean>;
    select(question: string, options: SelectOption[]): Promise<string>;
    printBanner(): void;
    printHelp(): void;
    printModelSwitch(model: ModelId): void;
    printProjectInfo(info: {
        name: string;
        language: string;
        path: string;
        files: string[];
    } | null): void;
    printError(message: string): void;
    printWarning(message: string): void;
    printSuccess(message: string): void;
    printInfo(message: string): void;
    printToolCall(toolName: string, detail: string): void;
    printToolResult(success: boolean, message: string): void;
    startStreaming(): void;
    streamText(text: string): void;
    endStreaming(): void;
    prompt(): Promise<string>;
    close(): void;
    clearScreen(): void;
}
