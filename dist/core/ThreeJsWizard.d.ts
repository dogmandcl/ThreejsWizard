import { ModelId } from './types.js';
export interface WizardOptions {
    model?: ModelId;
}
export declare class ThreeJsWizard {
    private ui;
    private engine;
    private projectManager;
    private workingDirectory;
    private isRunning;
    private hasOnboarded;
    private currentMode;
    constructor(options?: WizardOptions);
    start(): Promise<void>;
    private handleCommand;
    stop(): void;
}
