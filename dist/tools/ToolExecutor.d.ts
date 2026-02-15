import { ToolResult, ToolName } from '../core/types.js';
import { TerminalUI } from '../ui/TerminalUI.js';
export declare class ToolExecutor {
    private workingDirectory;
    private ui;
    private createdFiles;
    constructor(workingDirectory: string, ui: TerminalUI);
    getCreatedFiles(): string[];
    clearCreatedFiles(): void;
    /**
     * Validates that a path does not escape the working directory (path traversal prevention)
     */
    private validatePath;
    /**
     * Validates WriteFileInput structure and types
     */
    private validateWriteFileInput;
    /**
     * Validates ReadFileInput structure and types
     */
    private validateReadFileInput;
    /**
     * Validates RunCommandInput structure and types
     */
    private validateRunCommandInput;
    /**
     * Validates ListFilesInput structure and types
     */
    private validateListFilesInput;
    /**
     * Parses a command string into executable and arguments safely
     */
    private parseCommand;
    execute(toolName: ToolName, input: unknown): Promise<ToolResult>;
    private writeFile;
    private readFile;
    private runCommand;
    private listFiles;
    private listFilesRecursive;
}
