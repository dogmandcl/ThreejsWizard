import { TerminalUI } from '../ui/TerminalUI.js';
import { AgentEngine } from './AgentEngine.js';
import { ProjectManager } from '../project/ProjectManager.js';
import { ModelId } from './types.js';
import { runOnboarding, buildContextMessage } from '../ui/onboarding.js';

export interface WizardOptions {
  model?: ModelId;
}

export class ThreeJsWizard {
  private ui: TerminalUI;
  private engine: AgentEngine;
  private projectManager: ProjectManager;
  private workingDirectory: string;
  private isRunning = false;
  private hasOnboarded = false;

  constructor(options?: WizardOptions) {
    this.workingDirectory = process.cwd();
    this.ui = new TerminalUI();
    this.engine = new AgentEngine(this.ui, this.workingDirectory);
    this.projectManager = new ProjectManager(this.workingDirectory);

    if (options?.model) {
      this.engine.setModel(options.model);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;

    // Print welcome banner
    this.ui.printBanner();

    // Check for existing project or code
    const hasThreeJsProject = await this.projectManager.detectExistingProject();
    const hasExistingCode = await this.projectManager.hasExistingCode();
    const isEmptyDir = await this.projectManager.isEmptyDirectory();

    if (hasThreeJsProject) {
      const info = this.projectManager.getProjectInfo();
      if (info) {
        this.ui.printInfo(`  Detected Three.js project: ${info.name} (${info.language})`);
      }
      this.hasOnboarded = true;
    } else if (hasExistingCode) {
      this.ui.printInfo('  Detected existing code in this directory.');
      this.ui.printInfo('  Describe what you\'d like to add or modify.\n');
      this.hasOnboarded = true;
    }

    // Run onboarding only for empty directories
    if (!this.hasOnboarded && isEmptyDir) {
      const preferences = await runOnboarding(this.ui);
      this.hasOnboarded = true;

      // Process the initial project request
      const contextMessage = buildContextMessage(preferences);
      await this.engine.processMessage(contextMessage);
    } else if (!this.hasOnboarded) {
      // Directory has some files but we didn't recognize them
      this.hasOnboarded = true;
    }

    // Main REPL loop
    while (this.isRunning) {
      try {
        const input = await this.ui.prompt();

        if (!input) {
          continue;
        }

        // Handle commands
        if (input.startsWith('/')) {
          await this.handleCommand(input);
          continue;
        }

        // Process user message through agent
        await this.engine.processMessage(input);

        // Track created files
        for (const file of this.engine.getCreatedFiles()) {
          this.projectManager.addFile(file);
        }

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
          // readline was closed, exit gracefully
          break;
        }
        this.ui.printError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.ui.printHelp();
        break;

      case 'clear':
        this.engine.clearHistory();
        this.ui.clearScreen();
        this.ui.printSuccess('Conversation cleared');
        break;

      case 'exit':
      case 'quit':
        this.ui.printInfo('Goodbye!');
        this.isRunning = false;
        this.ui.close();
        break;

      case 'project':
        this.ui.printProjectInfo(this.projectManager.getProjectInfo());
        break;

      case 'model':
        if (args.length === 0) {
          this.ui.printInfo(`Current model: ${this.engine.getModel()}`);
          this.ui.printInfo('Available models: sonnet, opus, haiku, opus-4.5, opus-4.6');
        } else {
          const modelName = args[0].toLowerCase();
          if (['sonnet', 'opus', 'haiku', 'opus-4.5', 'opus-4.6'].includes(modelName)) {
            this.engine.setModel(modelName as ModelId);
            this.ui.printModelSwitch(modelName as ModelId);
          } else {
            this.ui.printError(`Unknown model: ${modelName}. Use: sonnet, opus, haiku, opus-4.5, or opus-4.6`);
          }
        }
        break;

      default:
        this.ui.printError(`Unknown command: ${command}. Type /help for available commands.`);
    }
  }

  stop(): void {
    this.isRunning = false;
    this.ui.close();
  }
}
