import { ModelId } from './types.js';
import { TerminalUI } from '../ui/TerminalUI.js';
export declare class AgentEngine {
    private client;
    private model;
    private conversationHistory;
    private toolExecutor;
    private ui;
    constructor(ui: TerminalUI, workingDirectory: string);
    private trimHistory;
    private sleep;
    setModel(model: ModelId): void;
    getModel(): ModelId;
    clearHistory(): void;
    getCreatedFiles(): string[];
    processMessage(userMessage: string): Promise<void>;
    private runAgentLoop;
    private runSingleTurn;
}
