import { ToolResult, ToolName } from '../core/types.js';
import { TerminalUI } from '../ui/TerminalUI.js';
export declare class ToolExecutor {
    private workingDirectory;
    private ui;
    private createdFiles;
    constructor(workingDirectory: string, ui: TerminalUI);
    getCreatedFiles(): string[];
    clearCreatedFiles(): void;
    execute(toolName: ToolName, input: unknown): Promise<ToolResult>;
    private writeFile;
    private readFile;
    private runCommand;
    private listFiles;
    private listFilesRecursive;
}
