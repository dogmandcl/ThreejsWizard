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
     * Tokenizes a single command (no pipes) into tokens respecting quotes
     */
    private tokenizeCommand;
    /**
     * Parses a command string into executable and arguments safely
     * Supports piped commands (e.g., "grep foo | wc -l")
     */
    private parseCommand;
    execute(toolName: ToolName, input: unknown): Promise<ToolResult>;
    private writeFile;
    private readFile;
    private runCommand;
    private listFiles;
    private listFilesRecursive;
}
