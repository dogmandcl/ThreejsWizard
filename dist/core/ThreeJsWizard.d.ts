export declare class ThreeJsWizard {
    private ui;
    private engine;
    private projectManager;
    private workingDirectory;
    private isRunning;
    private hasOnboarded;
    constructor();
    start(): Promise<void>;
    private handleCommand;
    stop(): void;
}
