import Anthropic from '@anthropic-ai/sdk';
import { MODEL_MAP, DEFAULT_MODEL } from './types.js';
import { toolDefinitions } from '../tools/definitions.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { THREEJS_SYSTEM_PROMPT } from '../prompts/system.js';
// Limits to prevent hitting rate limits
const MAX_HISTORY_MESSAGES = 20; // Keep last N messages
const MAX_TOKENS = 16384; // Needs to be large enough for file contents in tool calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds base delay
export class AgentEngine {
    client;
    model = DEFAULT_MODEL;
    conversationHistory = [];
    toolExecutor;
    ui;
    constructor(ui, workingDirectory) {
        this.client = new Anthropic();
        this.ui = ui;
        this.toolExecutor = new ToolExecutor(workingDirectory, ui);
    }
    // Trim conversation history to prevent token overflow
    trimHistory() {
        if (this.conversationHistory.length > MAX_HISTORY_MESSAGES) {
            // Keep the first message (initial context) and the last N-1 messages
            const first = this.conversationHistory[0];
            const recent = this.conversationHistory.slice(-(MAX_HISTORY_MESSAGES - 1));
            this.conversationHistory = [first, ...recent];
        }
    }
    // Sleep helper for retry delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    setModel(model) {
        this.model = model;
    }
    getModel() {
        return this.model;
    }
    clearHistory() {
        this.conversationHistory = [];
        this.toolExecutor.clearCreatedFiles();
    }
    getCreatedFiles() {
        return this.toolExecutor.getCreatedFiles();
    }
    async processMessage(userMessage) {
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
        });
        // Trim history to prevent token overflow
        this.trimHistory();
        // Run the agentic loop
        await this.runAgentLoop();
    }
    async runAgentLoop() {
        let continueLoop = true;
        while (continueLoop) {
            continueLoop = await this.runSingleTurn();
        }
    }
    async runSingleTurn(retryCount = 0) {
        try {
            // Show thinking indicator
            this.ui.startThinking('Thinking');
            // Create the API request with streaming
            const stream = this.client.messages.stream({
                model: MODEL_MAP[this.model],
                max_tokens: MAX_TOKENS,
                system: THREEJS_SYSTEM_PROMPT,
                tools: toolDefinitions,
                messages: this.conversationHistory,
            });
            // Collect response content
            const contentBlocks = [];
            let isFirstText = true;
            // Handle streaming events
            stream.on('text', (text) => {
                if (isFirstText) {
                    this.ui.stopThinking();
                    this.ui.startStreaming();
                    isFirstText = false;
                }
                this.ui.streamText(text);
            });
            // Wait for the complete response
            const response = await stream.finalMessage();
            // Make sure to stop thinking if no text was streamed
            this.ui.stopThinking();
            if (!isFirstText) {
                this.ui.endStreaming();
            }
            // Check for truncated response
            if (response.stop_reason === 'max_tokens') {
                this.ui.printWarning('Response was truncated due to length limit. Some tool calls may be incomplete.');
            }
            // Process all content blocks
            for (const block of response.content) {
                contentBlocks.push(block);
            }
            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: contentBlocks,
            });
            // Check if we need to process tool calls
            const toolUseBlocks = contentBlocks.filter((block) => block.type === 'tool_use');
            if (toolUseBlocks.length === 0) {
                // No tool calls, we're done
                return false;
            }
            // Show tool processing spinner
            this.ui.startToolProcessing(toolUseBlocks.length);
            // Execute all tool calls
            const toolResults = [];
            for (const toolUse of toolUseBlocks) {
                // Update spinner with current tool name
                this.ui.updateToolProcessing(toolUse.name);
                // Stop spinner before tool execution (which prints its own output)
                this.ui.stopToolProcessing();
                const result = await this.toolExecutor.execute(toolUse.name, toolUse.input);
                // Truncate large outputs to save tokens
                let output = result.success ? result.output : `Error: ${result.error}`;
                if (output.length > 2000) {
                    output = output.substring(0, 2000) + '\n... (truncated)';
                }
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: output,
                    is_error: !result.success,
                });
                // Restart spinner if more tools remain
                const remainingTools = toolUseBlocks.length - toolResults.length;
                if (remainingTools > 0) {
                    this.ui.startToolProcessing(remainingTools);
                }
            }
            // Add tool results to history
            this.conversationHistory.push({
                role: 'user',
                content: toolResults,
            });
            // Always continue after tool execution - model must see results
            return true;
        }
        catch (error) {
            this.ui.stopThinking();
            this.ui.stopToolProcessing();
            // Handle rate limit errors with retry
            if (error instanceof Anthropic.RateLimitError) {
                if (retryCount < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
                    this.ui.printWarning(`Rate limited. Retrying in ${delay / 1000}s...`);
                    await this.sleep(delay);
                    return this.runSingleTurn(retryCount + 1);
                }
                this.ui.printError('Rate limit exceeded. Please wait a moment and try again.');
                return false;
            }
            if (error instanceof Anthropic.APIError) {
                this.ui.printError(`API Error: ${error.message}`);
            }
            else {
                this.ui.printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
            }
            return false;
        }
    }
}
