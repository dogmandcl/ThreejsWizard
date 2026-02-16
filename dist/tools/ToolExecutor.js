import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { shouldValidate, validate } from './CodeValidator.js';
// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = new Set([
    // Package managers
    'npm', 'npx', 'pnpm', 'yarn', 'bun',
    // Build tools & runtimes
    'node', 'tsc', 'vite', 'esbuild', 'rollup', 'webpack',
    // Version control
    'git',
    // File operations
    'mkdir', 'touch', 'rm', 'cp', 'mv', 'chmod', 'ln',
    // File inspection
    'cat', 'ls', 'pwd', 'head', 'tail', 'wc', 'file', 'stat',
    // Search and text processing
    'grep', 'find', 'sed', 'awk', 'sort', 'uniq', 'diff', 'tr', 'cut',
    // System utilities
    'echo', 'which', 'whereis', 'env', 'basename', 'dirname', 'realpath',
    // Archive tools
    'tar', 'zip', 'unzip', 'gzip', 'gunzip',
    // Testing
    'jest', 'vitest', 'mocha', 'playwright', 'cypress',
]);
// Dangerous shell metacharacters that indicate command injection attempts
// Note: | (pipe) is allowed and handled specially for piped commands
const DANGEROUS_PATTERNS = /[;&`$(){}[\]<>!\\]/;
export class ToolExecutor {
    workingDirectory;
    ui;
    createdFiles = new Set();
    constructor(workingDirectory, ui) {
        this.workingDirectory = path.resolve(workingDirectory);
        this.ui = ui;
    }
    getCreatedFiles() {
        return Array.from(this.createdFiles);
    }
    clearCreatedFiles() {
        this.createdFiles.clear();
    }
    /**
     * Validates that a path does not escape the working directory (path traversal prevention)
     */
    validatePath(inputPath) {
        const fullPath = path.resolve(this.workingDirectory, inputPath);
        const normalized = path.normalize(fullPath);
        // Ensure the resolved path is within the working directory
        if (!normalized.startsWith(this.workingDirectory + path.sep) &&
            normalized !== this.workingDirectory) {
            throw new Error(`Path traversal not allowed: "${inputPath}" resolves outside working directory`);
        }
        return fullPath;
    }
    /**
     * Validates WriteFileInput structure and types
     */
    validateWriteFileInput(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object');
        }
        const obj = input;
        if (typeof obj.path !== 'string' || !obj.path.trim()) {
            throw new Error('Invalid input: path must be a non-empty string');
        }
        // Coerce content to string - handle various types the model might return
        let content;
        if (typeof obj.content === 'string') {
            content = obj.content;
        }
        else if (obj.content === null || obj.content === undefined) {
            content = '';
        }
        else if (Array.isArray(obj.content)) {
            // Model sometimes returns content as an array of strings
            content = obj.content.map(item => String(item)).join('\n');
        }
        else if (typeof obj.content === 'object') {
            // Fallback: stringify objects
            content = JSON.stringify(obj.content, null, 2);
        }
        else {
            // Fallback for numbers, booleans, etc.
            content = String(obj.content);
        }
        return {
            path: obj.path.trim(),
            content,
            skipValidation: obj.skipValidation === true
        };
    }
    /**
     * Validates ReadFileInput structure and types
     */
    validateReadFileInput(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object');
        }
        const obj = input;
        if (typeof obj.path !== 'string' || !obj.path.trim()) {
            throw new Error('Invalid input: path must be a non-empty string');
        }
        return { path: obj.path.trim() };
    }
    /**
     * Validates RunCommandInput structure and types
     */
    validateRunCommandInput(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object');
        }
        const obj = input;
        if (typeof obj.command !== 'string' || !obj.command.trim()) {
            throw new Error('Invalid input: command must be a non-empty string');
        }
        if (obj.cwd !== undefined && typeof obj.cwd !== 'string') {
            throw new Error('Invalid input: cwd must be a string');
        }
        return {
            command: obj.command.trim(),
            cwd: obj.cwd
        };
    }
    /**
     * Validates ListFilesInput structure and types
     */
    validateListFilesInput(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: expected object');
        }
        const obj = input;
        if (obj.path !== undefined && typeof obj.path !== 'string') {
            throw new Error('Invalid input: path must be a string');
        }
        if (obj.recursive !== undefined && typeof obj.recursive !== 'boolean') {
            throw new Error('Invalid input: recursive must be a boolean');
        }
        return {
            path: obj.path,
            recursive: obj.recursive
        };
    }
    /**
     * Tokenizes a single command (no pipes) into tokens respecting quotes
     */
    tokenizeCommand(cmdString) {
        const tokens = [];
        let current = '';
        let inQuote = null;
        for (let i = 0; i < cmdString.length; i++) {
            const char = cmdString[i];
            if (inQuote) {
                if (char === inQuote) {
                    inQuote = null;
                }
                else {
                    current += char;
                }
            }
            else if (char === '"' || char === "'") {
                inQuote = char;
            }
            else if (char === ' ' || char === '\t') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
        if (current) {
            tokens.push(current);
        }
        if (inQuote) {
            throw new Error('Unclosed quote in command');
        }
        return tokens;
    }
    /**
     * Parses a command string into executable and arguments safely
     * Supports piped commands (e.g., "grep foo | wc -l")
     */
    parseCommand(cmdString) {
        // Check for dangerous shell metacharacters (pipe is allowed)
        if (DANGEROUS_PATTERNS.test(cmdString)) {
            throw new Error('Command contains dangerous shell metacharacters');
        }
        // Check if command contains pipes
        const pipeSegments = cmdString.split('|').map(s => s.trim()).filter(s => s.length > 0);
        const isPiped = pipeSegments.length > 1;
        // Validate each command in the pipeline against the whitelist
        const pipeChain = [];
        for (const segment of pipeSegments) {
            const tokens = this.tokenizeCommand(segment);
            if (tokens.length === 0) {
                throw new Error('Empty command in pipeline');
            }
            const segmentCmd = tokens[0];
            if (!ALLOWED_COMMANDS.has(segmentCmd)) {
                throw new Error(`Command not allowed: ${segmentCmd}. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`);
            }
            pipeChain.push(segment);
        }
        // For the return value, use the first command's info
        const firstTokens = this.tokenizeCommand(pipeSegments[0]);
        const cmd = firstTokens[0];
        const args = firstTokens.slice(1);
        return { cmd, args, isPiped, pipeChain };
    }
    async execute(toolName, input) {
        switch (toolName) {
            case 'write_file':
                return this.writeFile(input);
            case 'read_file':
                return this.readFile(input);
            case 'run_command':
                return this.runCommand(input);
            case 'list_files':
                return this.listFiles(input);
            default:
                return {
                    success: false,
                    output: '',
                    error: `Unknown tool: ${toolName}`,
                };
        }
    }
    async writeFile(input) {
        try {
            // Validate input structure
            const validatedInput = this.validateWriteFileInput(input);
            // Validate path doesn't escape working directory
            const fullPath = this.validatePath(validatedInput.path);
            const dir = path.dirname(fullPath);
            // Run syntax validation for code files (unless skipped)
            if (!validatedInput.skipValidation && shouldValidate(validatedInput.path)) {
                const validationResult = validate(validatedInput.path, validatedInput.content);
                // If there are errors, don't write the file
                if (!validationResult.valid) {
                    const errorDetails = validationResult.errors.join('\n  - ');
                    this.ui.printToolCall('write_file', `Writing: ${validatedInput.path}`);
                    this.ui.printToolResult(false, 'Syntax validation failed');
                    return {
                        success: false,
                        output: '',
                        error: `Syntax validation failed for ${validatedInput.path}:\n  - ${errorDetails}\n\nFix the syntax errors and try again.`,
                    };
                }
                // Print warnings but continue
                if (validationResult.warnings.length > 0) {
                    for (const warning of validationResult.warnings) {
                        this.ui.printWarning(warning);
                    }
                }
            }
            // Create directory if it doesn't exist
            await fs.mkdir(dir, { recursive: true });
            // Write the file
            await fs.writeFile(fullPath, validatedInput.content, 'utf-8');
            this.createdFiles.add(validatedInput.path);
            this.ui.printToolCall('write_file', `Writing: ${validatedInput.path}`);
            this.ui.printToolResult(true, '');
            return {
                success: true,
                output: `Successfully wrote ${validatedInput.path}`,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const displayPath = input?.path || 'unknown';
            this.ui.printToolCall('write_file', `Writing: ${displayPath}`);
            this.ui.printToolResult(false, errorMessage);
            return {
                success: false,
                output: '',
                error: errorMessage,
            };
        }
    }
    async readFile(input) {
        try {
            // Validate input structure
            const validatedInput = this.validateReadFileInput(input);
            // Validate path doesn't escape working directory
            const fullPath = this.validatePath(validatedInput.path);
            const content = await fs.readFile(fullPath, 'utf-8');
            this.ui.printToolCall('read_file', `Reading: ${validatedInput.path}`);
            this.ui.printToolResult(true, '');
            return {
                success: true,
                output: content,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const displayPath = input?.path || 'unknown';
            this.ui.printToolCall('read_file', `Reading: ${displayPath}`);
            this.ui.printToolResult(false, errorMessage);
            return {
                success: false,
                output: '',
                error: errorMessage,
            };
        }
    }
    async runCommand(input) {
        try {
            // Validate input structure
            const validatedInput = this.validateRunCommandInput(input);
            // Parse command into executable and arguments
            // This also validates all commands in a pipeline against the whitelist
            const { cmd, args, isPiped, pipeChain } = this.parseCommand(validatedInput.command);
            // Validate and resolve cwd if provided
            let cwd = this.workingDirectory;
            if (validatedInput.cwd) {
                cwd = this.validatePath(validatedInput.cwd);
            }
            this.ui.printToolCall('run_command', `Command: ${validatedInput.command}`);
            // Ask for user confirmation before running any command
            const approved = await this.ui.confirm(`Run this command?`);
            if (!approved) {
                this.ui.printToolResult(false, 'User declined');
                return {
                    success: false,
                    output: '',
                    error: 'User declined to run this command',
                };
            }
            // For piped commands, use shell with pre-validated command string
            // For non-piped commands, use spawn without shell for security
            return new Promise((resolve) => {
                const child = isPiped
                    ? spawn('sh', ['-c', pipeChain.join(' | ')], {
                        cwd,
                        stdio: ['inherit', 'pipe', 'pipe'],
                        timeout: 60000, // 60 second timeout
                    })
                    : spawn(cmd, args, {
                        cwd,
                        stdio: ['inherit', 'pipe', 'pipe'],
                        timeout: 60000, // 60 second timeout
                        shell: false, // Explicitly disable shell for security
                    });
                let stdout = '';
                let stderr = '';
                child.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });
                child.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
                child.on('close', (code) => {
                    const output = stdout + (stderr ? `\nStderr: ${stderr}` : '');
                    if (code === 0) {
                        this.ui.printToolResult(true, '');
                        resolve({
                            success: true,
                            output: output || 'Command completed successfully',
                        });
                    }
                    else {
                        this.ui.printToolResult(false, `Exit code: ${code}`);
                        resolve({
                            success: false,
                            output: '',
                            error: `Command failed with exit code ${code}. ${output}`,
                        });
                    }
                });
                child.on('error', (error) => {
                    this.ui.printToolResult(false, error.message);
                    resolve({
                        success: false,
                        output: '',
                        error: error.message,
                    });
                });
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const displayCmd = input?.command || 'unknown';
            this.ui.printToolCall('run_command', `Command: ${displayCmd}`);
            this.ui.printToolResult(false, errorMessage);
            return {
                success: false,
                output: '',
                error: errorMessage,
            };
        }
    }
    async listFiles(input) {
        try {
            // Validate input structure
            const validatedInput = this.validateListFilesInput(input);
            // Validate path doesn't escape working directory
            const targetPath = validatedInput.path
                ? this.validatePath(validatedInput.path)
                : this.workingDirectory;
            this.ui.printToolCall('list_files', `Listing: ${validatedInput.path || '.'}`);
            const files = await this.listFilesRecursive(targetPath, validatedInput.recursive ?? false);
            // Format output
            const relativePaths = files.map(f => path.relative(this.workingDirectory, f));
            this.ui.printToolResult(true, '');
            return {
                success: true,
                output: relativePaths.length > 0
                    ? relativePaths.join('\n')
                    : '(empty directory)',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const displayPath = input?.path || '.';
            this.ui.printToolCall('list_files', `Listing: ${displayPath}`);
            this.ui.printToolResult(false, errorMessage);
            return {
                success: false,
                output: '',
                error: errorMessage,
            };
        }
    }
    async listFilesRecursive(dir, recursive) {
        // Validate dir is within working directory (defense in depth)
        const normalizedDir = path.normalize(dir);
        if (!normalizedDir.startsWith(this.workingDirectory + path.sep) &&
            normalizedDir !== this.workingDirectory) {
            throw new Error('Directory traversal not allowed');
        }
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            // Skip node_modules and hidden files
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (recursive) {
                    files.push(...await this.listFilesRecursive(fullPath, true));
                }
                else {
                    files.push(fullPath + '/');
                }
            }
            else {
                files.push(fullPath);
            }
        }
        return files;
    }
}
