#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'os';
import { startCommand } from './commands/start.js';
import { configCommand } from './commands/config.js';
import { modelCommand } from './commands/model.js';
// Safely get current working directory, fallback to home
function safeGetCwd() {
    try {
        return process.cwd();
    }
    catch {
        // If cwd is inaccessible (deleted directory, etc.), use home
        return homedir();
    }
}
const program = new Command();
program
    .name('threewzrd')
    .description('AI-powered CLI for generating Three.js projects from natural language')
    .version('1.0.0');
program
    .command('start')
    .description('Start the wizard REPL')
    .option('-d, --directory <path>', 'Working directory for the wizard', safeGetCwd())
    .option('-m, --model <model>', 'Model to use (sonnet, opus, haiku, opus-4.5, opus-4.6)')
    .action(startCommand);
program
    .command('config')
    .description('Manage API key and configuration')
    .option('-s, --set', 'Set or update API key')
    .option('-d, --delete', 'Delete saved API key')
    .option('-p, --path', 'Show config file path')
    .action(configCommand);
program
    .command('model [name]')
    .description('View or set the default model')
    .action(modelCommand);
program.parse();
