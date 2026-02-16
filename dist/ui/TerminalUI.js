import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
export class TerminalUI {
    rl;
    isStreaming = false;
    thinkingSpinner = null;
    toolSpinner = null;
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    // Thinking indicator with turn info
    startThinking(message = 'Thinking', turn) {
        const turnInfo = turn ? chalk.gray(` [Turn ${turn}]`) : '';
        this.thinkingSpinner = ora({
            text: chalk.cyan(message) + turnInfo,
            spinner: 'dots',
            discardStdin: false, // Don't interfere with readline
        }).start();
    }
    updateThinking(message, turn) {
        if (this.thinkingSpinner) {
            const turnInfo = turn ? chalk.gray(` [Turn ${turn}]`) : '';
            this.thinkingSpinner.text = chalk.cyan(message) + turnInfo;
        }
    }
    stopThinking() {
        if (this.thinkingSpinner) {
            this.thinkingSpinner.stop();
            this.thinkingSpinner = null;
        }
        // Ensure stdin is still active for readline after ora releases it
        if (process.stdin.isPaused()) {
            process.stdin.resume();
        }
    }
    // Tool execution spinner
    startToolSpinner(toolName, detail) {
        this.toolSpinner = ora({
            text: chalk.yellow(`${toolName}: `) + chalk.gray(detail),
            spinner: 'dots',
            discardStdin: false,
        }).start();
    }
    succeedToolSpinner(message) {
        if (this.toolSpinner) {
            this.toolSpinner.succeed(message ? chalk.green(message) : undefined);
            this.toolSpinner = null;
        }
    }
    failToolSpinner(message) {
        if (this.toolSpinner) {
            this.toolSpinner.fail(chalk.red(message));
            this.toolSpinner = null;
        }
    }
    stopToolSpinner() {
        if (this.toolSpinner) {
            this.toolSpinner.stop();
            this.toolSpinner = null;
        }
    }
    // Confirmation prompt for dangerous actions
    async confirm(message) {
        // Ensure any spinner is stopped
        this.stopThinking();
        return new Promise((resolve) => {
            console.log();
            this.rl.question(chalk.yellow(`  ⚠ ${message} `) + chalk.gray('[y/N] '), (answer) => {
                const normalized = answer.trim().toLowerCase();
                resolve(normalized === 'y' || normalized === 'yes');
            });
        });
    }
    // Selection menu for multiple choices
    async select(question, options) {
        console.log();
        console.log(chalk.cyan(`  ${question}`));
        console.log();
        options.forEach((opt, index) => {
            console.log(chalk.white(`    ${index + 1}) `) + chalk.gray(opt.label));
        });
        console.log();
        return new Promise((resolve) => {
            const askChoice = () => {
                this.rl.question(chalk.magenta('  › '), (answer) => {
                    const num = parseInt(answer.trim(), 10);
                    if (num >= 1 && num <= options.length) {
                        resolve(options[num - 1].value);
                    }
                    else {
                        console.log(chalk.red('  Please enter a valid number'));
                        askChoice();
                    }
                });
            };
            askChoice();
        });
    }
    printBanner() {
        console.log();
        console.log(chalk.magenta.bold('  ╔═══════════════════════════════════════╗'));
        console.log(chalk.magenta.bold('  ║         ') + chalk.white.bold('Three.js Wizard') + chalk.magenta.bold('              ║'));
        console.log(chalk.magenta.bold('  ╚═══════════════════════════════════════╝'));
        console.log();
        console.log(chalk.cyan('  Your AI assistant for 3D web development'));
        console.log();
        console.log(chalk.gray('  I can help you create Three.js scenes, add objects,'));
        console.log(chalk.gray('  lighting, animations, and more - just describe what'));
        console.log(chalk.gray('  you want in plain English.'));
        console.log();
        console.log(chalk.gray('  Modes: ') + chalk.cyan('⚡ Quick') + chalk.gray(' | ') + chalk.magenta('📋 Plan') + chalk.gray('  (Tab to switch)'));
        console.log(chalk.gray('  Commands: ') + chalk.yellow('/help') + chalk.gray(' | ') + chalk.yellow('/clear') + chalk.gray(' | ') + chalk.yellow('/exit'));
        console.log();
        console.log(chalk.gray('  ─────────────────────────────────────────'));
        console.log();
    }
    printHelp() {
        console.log();
        console.log(chalk.yellow('Execution Modes:'));
        console.log(chalk.cyan('  ⚡ Quick Mode') + chalk.gray('        - Direct implementation (default)'));
        console.log(chalk.magenta('  📋 Plan Mode') + chalk.gray('         - Detailed architecture plan first'));
        console.log(chalk.gray('  Press Tab while typing to switch modes'));
        console.log();
        console.log(chalk.yellow('Commands:'));
        console.log(chalk.cyan('  /help') + chalk.gray('              - Show this help message'));
        console.log(chalk.cyan('  /clear') + chalk.gray('             - Clear conversation history'));
        console.log(chalk.cyan('  /exit') + chalk.gray('              - Exit the wizard'));
        console.log(chalk.cyan('  /project') + chalk.gray('           - Show current project info'));
        console.log(chalk.cyan('  /model [name]') + chalk.gray('      - Switch model (sonnet, opus, haiku)'));
        console.log();
        console.log(chalk.yellow('Examples:'));
        console.log(chalk.gray('  "Create a spinning cube with metallic material"'));
        console.log(chalk.gray('  "Add orbit controls and a grid helper"'));
        console.log(chalk.gray('  "Create a particle system with 10,000 points"'));
        console.log();
        console.log(chalk.yellow('API Key Management:'));
        console.log(chalk.gray('  To manage your Anthropic API key, exit and run:'));
        console.log(chalk.cyan('  threewzrd config') + chalk.gray('      - View current config'));
        console.log(chalk.cyan('  threewzrd config -s') + chalk.gray('   - Set or rotate API key'));
        console.log(chalk.cyan('  threewzrd config -d') + chalk.gray('   - Delete saved API key'));
        console.log(chalk.cyan('  threewzrd config -p') + chalk.gray('   - Show config file path'));
        console.log();
    }
    printModelSwitch(model) {
        const modelNames = {
            sonnet: 'Claude Sonnet 4',
            opus: 'Claude Opus 4',
            haiku: 'Claude Haiku 4',
            'opus-4.5': 'Claude Opus 4.5',
            'opus-4.6': 'Claude Opus 4.6',
        };
        console.log(chalk.green(`Switched to ${modelNames[model]}`));
    }
    printProjectInfo(info) {
        if (!info) {
            console.log(chalk.yellow('No project created yet. Start by describing what you want to build!'));
            return;
        }
        console.log();
        console.log(chalk.yellow('Current Project:'));
        console.log(chalk.cyan('  Name: ') + info.name);
        console.log(chalk.cyan('  Language: ') + info.language);
        console.log(chalk.cyan('  Path: ') + info.path);
        console.log(chalk.cyan('  Files:'));
        info.files.forEach(f => console.log(chalk.gray('    - ' + f)));
        console.log();
    }
    printError(message) {
        console.log(chalk.red('Error: ') + message);
    }
    printWarning(message) {
        console.log(chalk.yellow('Warning: ') + message);
    }
    printSuccess(message) {
        console.log(chalk.green(message));
    }
    printInfo(message) {
        console.log(chalk.blue(message));
    }
    printToolCall(toolName, detail) {
        console.log();
        console.log(chalk.yellow(`[Tool: ${toolName}]`));
        console.log(chalk.gray(`  ${detail}`));
    }
    printToolResult(success, message) {
        if (success) {
            console.log(chalk.green(`  Done`));
        }
        else {
            console.log(chalk.red(`  Failed: ${message}`));
        }
    }
    startStreaming() {
        this.isStreaming = true;
        process.stdout.write('\n');
    }
    streamText(text) {
        if (this.isStreaming) {
            process.stdout.write(chalk.white(text));
        }
    }
    endStreaming() {
        if (this.isStreaming) {
            process.stdout.write('\n\n');
            this.isStreaming = false;
        }
    }
    async prompt() {
        return new Promise((resolve) => {
            this.rl.question(chalk.magenta('  › '), (answer) => {
                resolve(answer.trim());
            });
        });
    }
    // Mode-aware prompt with Tab toggle for execution mode
    async promptWithMode(defaultMode = 'single-shot') {
        let currentMode = defaultMode;
        // Print mode indicator and instructions
        const printModeBar = () => {
            const singleShot = currentMode === 'single-shot'
                ? chalk.bgCyan.black(' ⚡ Quick ')
                : chalk.gray(' ⚡ Quick ');
            const planning = currentMode === 'planning'
                ? chalk.bgMagenta.white(' 📋 Plan ')
                : chalk.gray(' 📋 Plan ');
            // Clear line and reprint
            process.stdout.write('\r\x1b[K');
            process.stdout.write(`  ${singleShot} ${planning}  ${chalk.gray('Tab to switch')}\n`);
        };
        return new Promise((resolve) => {
            printModeBar();
            console.log();
            // Close the existing readline interface to fully release stdin
            this.rl.close();
            // Store the current input
            let inputBuffer = '';
            // Set up raw mode for keypress detection
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            const promptPrefix = chalk.magenta('  › ');
            process.stdout.write(promptPrefix);
            const handleKeypress = (chunk) => {
                const key = chunk.toString();
                // Tab key - toggle mode
                if (key === '\t') {
                    currentMode = currentMode === 'single-shot' ? 'planning' : 'single-shot';
                    // Move cursor up, clear the mode bar, reprint it, move back down
                    process.stdout.write('\x1b[2A'); // Move up 2 lines
                    printModeBar();
                    console.log();
                    process.stdout.write(promptPrefix + inputBuffer);
                    return;
                }
                // Enter key - submit
                if (key === '\r' || key === '\n') {
                    process.stdout.write('\n');
                    cleanup();
                    resolve({ text: inputBuffer.trim(), mode: currentMode });
                    return;
                }
                // Ctrl+C - exit
                if (key === '\x03') {
                    cleanup();
                    process.exit(0);
                }
                // Backspace
                if (key === '\x7f' || key === '\b') {
                    if (inputBuffer.length > 0) {
                        inputBuffer = inputBuffer.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    return;
                }
                // Escape sequences (arrow keys, etc.) - ignore for simplicity
                if (key.startsWith('\x1b')) {
                    return;
                }
                // Regular character
                if (key.length === 1 && key.charCodeAt(0) >= 32) {
                    inputBuffer += key;
                    process.stdout.write(key);
                }
            };
            const cleanup = () => {
                process.stdin.removeListener('data', handleKeypress);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                // Recreate readline interface
                this.rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
            };
            process.stdin.on('data', handleKeypress);
        });
    }
    printModeInfo(mode) {
        if (mode === 'single-shot') {
            console.log(chalk.cyan('  ⚡ Quick Mode: ') + chalk.gray('Direct implementation without formal planning'));
        }
        else {
            console.log(chalk.magenta('  📋 Plan Mode: ') + chalk.gray('Detailed architecture plan before implementation'));
        }
        console.log();
    }
    close() {
        this.rl.close();
    }
    clearScreen() {
        console.clear();
        this.printBanner();
    }
}
