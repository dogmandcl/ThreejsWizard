import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectConfig, ProjectLanguage } from '../core/types.js';

export class ProjectManager {
  private config: ProjectConfig | null = null;
  private files: Set<string> = new Set();
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  async initProject(name: string, language: ProjectLanguage): Promise<void> {
    this.config = {
      name,
      language,
      path: this.workingDirectory,
      createdAt: new Date(),
    };
    this.files.clear();
  }

  getConfig(): ProjectConfig | null {
    return this.config;
  }

  addFile(filePath: string): void {
    this.files.add(filePath);
  }

  getFiles(): string[] {
    return Array.from(this.files);
  }

  getProjectInfo(): { name: string; language: string; path: string; files: string[] } | null {
    if (!this.config) return null;
    return {
      name: this.config.name,
      language: this.config.language,
      path: this.config.path,
      files: this.getFiles(),
    };
  }

  async detectExistingProject(): Promise<boolean> {
    try {
      const packageJsonPath = path.join(this.workingDirectory, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      // Check if it's a Three.js project
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.three) {
        const isTs = !!deps.typescript;
        this.config = {
          name: pkg.name || 'threejs-project',
          language: isTs ? 'typescript' : 'javascript',
          path: this.workingDirectory,
          createdAt: new Date(),
        };

        // Scan for existing files
        await this.scanFiles();
        return true;
      }
    } catch {
      // No existing project
    }
    return false;
  }

  async isEmptyDirectory(): Promise<boolean> {
    try {
      const entries = await fs.readdir(this.workingDirectory, { withFileTypes: true });

      // Filter out hidden files and common non-code files
      const significantFiles = entries.filter(entry => {
        const name = entry.name;
        // Ignore hidden files, .git, etc.
        if (name.startsWith('.')) return false;
        // Ignore common non-essential files
        if (name === 'node_modules' || name === '.DS_Store') return false;
        return true;
      });

      return significantFiles.length === 0;
    } catch {
      // If we can't read the directory, treat it as empty
      return true;
    }
  }

  async hasExistingCode(): Promise<boolean> {
    // Check for common code indicators
    const codeIndicators = [
      'package.json',
      'index.html',
      'index.js',
      'index.ts',
      'main.js',
      'main.ts',
      'src',
      'app.js',
      'app.ts',
    ];

    for (const indicator of codeIndicators) {
      try {
        const fullPath = path.join(this.workingDirectory, indicator);
        await fs.access(fullPath);
        return true;
      } catch {
        // File doesn't exist, continue checking
      }
    }

    return false;
  }

  private async scanFiles(dir?: string): Promise<void> {
    const targetDir = dir || this.workingDirectory;

    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(targetDir, entry.name);
        const relativePath = path.relative(this.workingDirectory, fullPath);

        if (entry.isDirectory()) {
          await this.scanFiles(fullPath);
        } else {
          this.files.add(relativePath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  clear(): void {
    this.config = null;
    this.files.clear();
  }
}
