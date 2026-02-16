import Anthropic from '@anthropic-ai/sdk';
export type ModelId = 'sonnet' | 'opus' | 'haiku' | 'opus-4.5' | 'opus-4.6';
export declare const MODEL_MAP: Record<ModelId, string>;
export declare const DEFAULT_MODEL: ModelId;
export type ProjectLanguage = 'javascript' | 'typescript';
export type ProjectTarget = 'browser' | 'mobile' | 'desktop';
export type ExecutionMode = 'single-shot' | 'planning';
export interface ProjectPreferences {
    language: ProjectLanguage;
    target: ProjectTarget;
    description: string;
    mode: ExecutionMode;
}
export interface ProjectConfig {
    name: string;
    language: ProjectLanguage;
    target?: ProjectTarget;
    path: string;
    createdAt: Date;
}
export type MessageParam = Anthropic.MessageParam;
export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}
export interface FileInfo {
    path: string;
    size: number;
    isDirectory: boolean;
}
export type ToolName = 'write_file' | 'read_file' | 'run_command' | 'list_files';
export interface WriteFileInput {
    path: string;
    content: string;
    skipValidation?: boolean;
}
export interface ReadFileInput {
    path: string;
}
export interface RunCommandInput {
    command: string;
    cwd?: string;
}
export interface ListFilesInput {
    path?: string;
    recursive?: boolean;
}
export type ToolInput = WriteFileInput | ReadFileInput | RunCommandInput | ListFilesInput;
