import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { ToolResult, ToolName, WriteFileInput, ReadFileInput, RunCommandInput, ListFilesInput } from '../core/types.js';
import { TerminalUI } from '../ui/TerminalUI.js';

// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = new Set([
  'npm',
  'npx',
  'node',
  'mkdir',
  'git',
  'pnpm',
  'yarn',
  'bun',
  'tsc',
  'vite',
  'esbuild',
  'cat',
  'ls',
  'pwd',
  'echo',
]);

// Dangerous shell metacharacters that indicate command injection attempts
const DANGEROUS_PATTERNS = /[;&|`$(){}[\]<>!\\]/;

export class ToolExecutor {
  private workingDirectory: string;
  private ui: TerminalUI;
  private createdFiles: Set<string> = new Set();

  constructor(workingDirectory: string, ui: TerminalUI) {
    this.workingDirectory = path.resolve(workingDirectory);
    this.ui = ui;
  }

  getCreatedFiles(): string[] {
    return Array.from(this.createdFiles);
  }

  clearCreatedFiles(): void {
    this.createdFiles.clear();
  }

  /**
   * Validates that a path does not escape the working directory (path traversal prevention)
   */
  private validatePath(inputPath: string): string {
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
  private validateWriteFileInput(input: unknown): WriteFileInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object');
    }
    const obj = input as Record<string, unknown>;

    if (typeof obj.path !== 'string' || !obj.path.trim()) {
      throw new Error('Invalid input: path must be a non-empty string');
    }
    if (typeof obj.content !== 'string') {
      throw new Error('Invalid input: content must be a string');
    }

    return { path: obj.path.trim(), content: obj.content };
  }

  /**
   * Validates ReadFileInput structure and types
   */
  private validateReadFileInput(input: unknown): ReadFileInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object');
    }
    const obj = input as Record<string, unknown>;

    if (typeof obj.path !== 'string' || !obj.path.trim()) {
      throw new Error('Invalid input: path must be a non-empty string');
    }

    return { path: obj.path.trim() };
  }

  /**
   * Validates RunCommandInput structure and types
   */
  private validateRunCommandInput(input: unknown): RunCommandInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object');
    }
    const obj = input as Record<string, unknown>;

    if (typeof obj.command !== 'string' || !obj.command.trim()) {
      throw new Error('Invalid input: command must be a non-empty string');
    }
    if (obj.cwd !== undefined && typeof obj.cwd !== 'string') {
      throw new Error('Invalid input: cwd must be a string');
    }

    return {
      command: obj.command.trim(),
      cwd: obj.cwd as string | undefined
    };
  }

  /**
   * Validates ListFilesInput structure and types
   */
  private validateListFilesInput(input: unknown): ListFilesInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object');
    }
    const obj = input as Record<string, unknown>;

    if (obj.path !== undefined && typeof obj.path !== 'string') {
      throw new Error('Invalid input: path must be a string');
    }
    if (obj.recursive !== undefined && typeof obj.recursive !== 'boolean') {
      throw new Error('Invalid input: recursive must be a boolean');
    }

    return {
      path: obj.path as string | undefined,
      recursive: obj.recursive as boolean | undefined
    };
  }

  /**
   * Parses a command string into executable and arguments safely
   */
  private parseCommand(cmdString: string): { cmd: string; args: string[] } {
    // Check for dangerous shell metacharacters
    if (DANGEROUS_PATTERNS.test(cmdString)) {
      throw new Error('Command contains dangerous shell metacharacters');
    }

    // Simple tokenization - split on whitespace, respecting quotes
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < cmdString.length; i++) {
      const char = cmdString[i];

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    if (inQuote) {
      throw new Error('Unclosed quote in command');
    }

    if (tokens.length === 0) {
      throw new Error('Empty command');
    }

    const cmd = tokens[0];
    const args = tokens.slice(1);

    return { cmd, args };
  }

  async execute(toolName: ToolName, input: unknown): Promise<ToolResult> {
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

  private async writeFile(input: unknown): Promise<ToolResult> {
    try {
      // Validate input structure
      const validatedInput = this.validateWriteFileInput(input);

      // Validate path doesn't escape working directory
      const fullPath = this.validatePath(validatedInput.path);
      const dir = path.dirname(fullPath);

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const displayPath = (input as WriteFileInput)?.path || 'unknown';
      this.ui.printToolCall('write_file', `Writing: ${displayPath}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async readFile(input: unknown): Promise<ToolResult> {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const displayPath = (input as ReadFileInput)?.path || 'unknown';
      this.ui.printToolCall('read_file', `Reading: ${displayPath}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async runCommand(input: unknown): Promise<ToolResult> {
    try {
      // Validate input structure
      const validatedInput = this.validateRunCommandInput(input);

      // Parse command into executable and arguments
      const { cmd, args } = this.parseCommand(validatedInput.command);

      // Check if command is in whitelist
      if (!ALLOWED_COMMANDS.has(cmd)) {
        this.ui.printToolCall('run_command', `Command: ${validatedInput.command}`);
        this.ui.printToolResult(false, `Command not allowed: ${cmd}`);
        return {
          success: false,
          output: '',
          error: `Command not allowed: ${cmd}. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`,
        };
      }

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

      // Use spawn instead of exec for security (no shell interpretation)
      return new Promise((resolve) => {
        const child = spawn(cmd, args, {
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
          } else {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const displayCmd = (input as RunCommandInput)?.command || 'unknown';
      this.ui.printToolCall('run_command', `Command: ${displayCmd}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async listFiles(input: unknown): Promise<ToolResult> {
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
      const relativePaths = files.map(f =>
        path.relative(this.workingDirectory, f)
      );

      this.ui.printToolResult(true, '');

      return {
        success: true,
        output: relativePaths.length > 0
          ? relativePaths.join('\n')
          : '(empty directory)',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const displayPath = (input as ListFilesInput)?.path || '.';
      this.ui.printToolCall('list_files', `Listing: ${displayPath}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async listFilesRecursive(dir: string, recursive: boolean): Promise<string[]> {
    // Validate dir is within working directory (defense in depth)
    const normalizedDir = path.normalize(dir);
    if (!normalizedDir.startsWith(this.workingDirectory + path.sep) &&
        normalizedDir !== this.workingDirectory) {
      throw new Error('Directory traversal not allowed');
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      // Skip node_modules and hidden files
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          files.push(...await this.listFilesRecursive(fullPath, true));
        } else {
          files.push(fullPath + '/');
        }
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
