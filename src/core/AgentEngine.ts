import Anthropic from '@anthropic-ai/sdk';
import { ModelId, MODEL_MAP, MessageParam, ToolName, DEFAULT_MODEL } from './types.js';
import { toolDefinitions } from '../tools/definitions.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { TerminalUI } from '../ui/TerminalUI.js';
import { THREEJS_SYSTEM_PROMPT } from '../prompts/system.js';

// Limits to prevent hitting rate limits
const MAX_HISTORY_MESSAGES = 20; // Keep last N messages
const MAX_TOKENS = 4096; // Reduced from 8192
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds base delay

export class AgentEngine {
  private client: Anthropic;
  private model: ModelId = DEFAULT_MODEL;
  private conversationHistory: MessageParam[] = [];
  private toolExecutor: ToolExecutor;
  private ui: TerminalUI;

  constructor(ui: TerminalUI, workingDirectory: string) {
    this.client = new Anthropic();
    this.ui = ui;
    this.toolExecutor = new ToolExecutor(workingDirectory, ui);
  }

  // Trim conversation history to prevent token overflow
  private trimHistory(): void {
    if (this.conversationHistory.length > MAX_HISTORY_MESSAGES) {
      // Keep the first message (initial context) and the last N-1 messages
      const first = this.conversationHistory[0];
      const recent = this.conversationHistory.slice(-(MAX_HISTORY_MESSAGES - 1));
      this.conversationHistory = [first, ...recent];
    }
  }

  // Sleep helper for retry delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setModel(model: ModelId): void {
    this.model = model;
  }

  getModel(): ModelId {
    return this.model;
  }

  clearHistory(): void {
    this.conversationHistory = [];
    this.toolExecutor.clearCreatedFiles();
  }

  getCreatedFiles(): string[] {
    return this.toolExecutor.getCreatedFiles();
  }

  async processMessage(userMessage: string): Promise<void> {
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

  private async runAgentLoop(): Promise<void> {
    let continueLoop = true;
    let turn = 1;

    while (continueLoop) {
      continueLoop = await this.runSingleTurn(turn);
      turn++;
    }
  }

  private async runSingleTurn(turn: number, retryCount = 0): Promise<boolean> {
    try {
      // Show thinking indicator with turn info
      const thinkingMessage = turn === 1 ? 'Thinking' : 'Processing';
      this.ui.startThinking(thinkingMessage, turn);

      // Create the API request with streaming
      const stream = this.client.messages.stream({
        model: MODEL_MAP[this.model],
        max_tokens: MAX_TOKENS,
        system: THREEJS_SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: this.conversationHistory,
      });

      // Collect response content
      const contentBlocks: Anthropic.ContentBlock[] = [];
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
      const toolUseBlocks = contentBlocks.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No tool calls, we're done
        return false;
      }

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      const totalTools = toolUseBlocks.length;

      for (let i = 0; i < toolUseBlocks.length; i++) {
        const toolUse = toolUseBlocks[i];
        const toolProgress = totalTools > 1 ? ` (${i + 1}/${totalTools})` : '';
        this.ui.startThinking(`Executing ${toolUse.name}${toolProgress}`, turn);

        const result = await this.toolExecutor.execute(
          toolUse.name as ToolName,
          toolUse.input
        );

        this.ui.stopThinking();

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
      }

      // Add tool results to history
      this.conversationHistory.push({
        role: 'user',
        content: toolResults,
      });

      // Continue the loop if we have tool results to process
      return response.stop_reason === 'tool_use';

    } catch (error) {
      this.ui.stopThinking();

      // Handle rate limit errors with retry
      if (error instanceof Anthropic.RateLimitError) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
          this.ui.printWarning(`Rate limited. Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
          return this.runSingleTurn(turn, retryCount + 1);
        }
        this.ui.printError('Rate limit exceeded. Please wait a moment and try again.');
        return false;
      }

      if (error instanceof Anthropic.APIError) {
        this.ui.printError(`API Error: ${error.message}`);
      } else {
        this.ui.printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return false;
    }
  }
}
