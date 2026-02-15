import { ProjectConfig, ProjectLanguage } from '../core/types.js';
export declare class ProjectManager {
    private config;
    private files;
    private workingDirectory;
    constructor(workingDirectory: string);
    initProject(name: string, language: ProjectLanguage): Promise<void>;
    getConfig(): ProjectConfig | null;
    addFile(filePath: string): void;
    getFiles(): string[];
    getProjectInfo(): {
        name: string;
        language: string;
        path: string;
        files: string[];
    } | null;
    detectExistingProject(): Promise<boolean>;
    isEmptyDirectory(): Promise<boolean>;
    hasExistingCode(): Promise<boolean>;
    private scanFiles;
    clear(): void;
}
