import { ModelId, ExecutionMode } from '../core/types.js';
export interface SelectOption {
    label: string;
    value: string;
}
export declare class TerminalUI {
    private rl;
    private isStreaming;
    private thinkingSpinner;
    private toolSpinner;
    constructor();
    startThinking(message?: string, turn?: number): void;
    updateThinking(message: string, turn?: number): void;
    stopThinking(): void;
    startToolSpinner(toolName: string, detail: string): void;
    succeedToolSpinner(message?: string): void;
    failToolSpinner(message: string): void;
    stopToolSpinner(): void;
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
    promptWithMode(defaultMode?: ExecutionMode): Promise<{
        text: string;
        mode: ExecutionMode;
    }>;
    printModeInfo(mode: ExecutionMode): void;
    close(): void;
    clearScreen(): void;
}
