import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult, ToolName, WriteFileInput, ReadFileInput, RunCommandInput, ListFilesInput } from '../core/types.js';
import { TerminalUI } from '../ui/TerminalUI.js';

const execAsync = promisify(exec);

export class ToolExecutor {
  private workingDirectory: string;
  private ui: TerminalUI;
  private createdFiles: Set<string> = new Set();

  constructor(workingDirectory: string, ui: TerminalUI) {
    this.workingDirectory = workingDirectory;
    this.ui = ui;
  }

  getCreatedFiles(): string[] {
    return Array.from(this.createdFiles);
  }

  clearCreatedFiles(): void {
    this.createdFiles.clear();
  }

  async execute(toolName: ToolName, input: unknown): Promise<ToolResult> {
    switch (toolName) {
      case 'write_file':
        return this.writeFile(input as WriteFileInput);
      case 'read_file':
        return this.readFile(input as ReadFileInput);
      case 'run_command':
        return this.runCommand(input as RunCommandInput);
      case 'list_files':
        return this.listFiles(input as ListFilesInput);
      default:
        return {
          success: false,
          output: '',
          error: `Unknown tool: ${toolName}`,
        };
    }
  }

  private async writeFile(input: WriteFileInput): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(this.workingDirectory, input.path);
      const dir = path.dirname(fullPath);

      // Create directory if it doesn't exist
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(fullPath, input.content, 'utf-8');

      this.createdFiles.add(input.path);
      this.ui.printToolCall('write_file', `Writing: ${input.path}`);
      this.ui.printToolResult(true, '');

      return {
        success: true,
        output: `Successfully wrote ${input.path}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.ui.printToolCall('write_file', `Writing: ${input.path}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async readFile(input: ReadFileInput): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(this.workingDirectory, input.path);
      const content = await fs.readFile(fullPath, 'utf-8');

      this.ui.printToolCall('read_file', `Reading: ${input.path}`);
      this.ui.printToolResult(true, '');

      return {
        success: true,
        output: content,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.ui.printToolCall('read_file', `Reading: ${input.path}`);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async runCommand(input: RunCommandInput): Promise<ToolResult> {
    try {
      const cwd = input.cwd
        ? path.resolve(this.workingDirectory, input.cwd)
        : this.workingDirectory;

      this.ui.printToolCall('run_command', `Command: ${input.command}`);

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

      const { stdout, stderr } = await execAsync(input.command, {
        cwd,
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      const output = stdout + (stderr ? `\nStderr: ${stderr}` : '');
      this.ui.printToolResult(true, '');

      return {
        success: true,
        output: output || 'Command completed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async listFiles(input: ListFilesInput): Promise<ToolResult> {
    try {
      const targetPath = input.path
        ? path.resolve(this.workingDirectory, input.path)
        : this.workingDirectory;

      this.ui.printToolCall('list_files', `Listing: ${input.path || '.'}`);

      const files = await this.listFilesRecursive(targetPath, input.recursive ?? false);

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
      this.ui.printToolResult(false, errorMessage);
      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  private async listFilesRecursive(dir: string, recursive: boolean): Promise<string[]> {
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
