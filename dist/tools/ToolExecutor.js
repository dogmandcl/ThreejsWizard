import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class ToolExecutor {
    workingDirectory;
    ui;
    createdFiles = new Set();
    constructor(workingDirectory, ui) {
        this.workingDirectory = workingDirectory;
        this.ui = ui;
    }
    getCreatedFiles() {
        return Array.from(this.createdFiles);
    }
    clearCreatedFiles() {
        this.createdFiles.clear();
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
        }
        catch (error) {
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
    async readFile(input) {
        try {
            const fullPath = path.resolve(this.workingDirectory, input.path);
            const content = await fs.readFile(fullPath, 'utf-8');
            this.ui.printToolCall('read_file', `Reading: ${input.path}`);
            this.ui.printToolResult(true, '');
            return {
                success: true,
                output: content,
            };
        }
        catch (error) {
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
    async runCommand(input) {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
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
            const targetPath = input.path
                ? path.resolve(this.workingDirectory, input.path)
                : this.workingDirectory;
            this.ui.printToolCall('list_files', `Listing: ${input.path || '.'}`);
            const files = await this.listFilesRecursive(targetPath, input.recursive ?? false);
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
            this.ui.printToolResult(false, errorMessage);
            return {
                success: false,
                output: '',
                error: errorMessage,
            };
        }
    }
    async listFilesRecursive(dir, recursive) {
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
