import { homedir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import * as readline from 'readline';
import chalk from 'chalk';
const CONFIG_DIR = join(homedir(), '.threewzrd');
const CONFIG_PATH = join(CONFIG_DIR, '.env');
async function promptInput(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
async function showConfig() {
    console.log();
    console.log(chalk.cyan('  Configuration'));
    console.log(chalk.gray('  ─────────────────────────────────────────'));
    console.log();
    console.log(chalk.gray('  Config location: ') + CONFIG_PATH);
    console.log();
    try {
        const content = await readFile(CONFIG_PATH, 'utf-8');
        const hasKey = content.includes('ANTHROPIC_API_KEY=');
        if (hasKey) {
            // Extract and mask the key
            const match = content.match(/ANTHROPIC_API_KEY=(.+)/);
            if (match && match[1]) {
                const key = match[1].trim();
                const masked = key.substring(0, 10) + '...' + key.substring(key.length - 4);
                console.log(chalk.gray('  API Key: ') + chalk.green(masked));
            }
        }
        else {
            console.log(chalk.yellow('  No API key configured'));
        }
    }
    catch {
        console.log(chalk.yellow('  No config file found'));
    }
    console.log();
}
async function setApiKey() {
    console.log();
    const apiKey = await promptInput(chalk.magenta('  Enter new API key: '));
    if (!apiKey) {
        console.log(chalk.red('  No key provided. Cancelled.'));
        return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
        console.log(chalk.yellow('  Warning: Key doesn\'t look like an Anthropic key (expected sk-ant-...)'));
        const proceed = await promptInput(chalk.gray('  Save anyway? [y/N] '));
        if (proceed.toLowerCase() !== 'y') {
            console.log(chalk.gray('  Cancelled.'));
            return;
        }
    }
    try {
        await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
        await writeFile(CONFIG_PATH, `ANTHROPIC_API_KEY=${apiKey}\n`, { mode: 0o600 });
        console.log();
        console.log(chalk.green('  API key updated successfully'));
    }
    catch (error) {
        console.log(chalk.red('  Failed to save API key'));
    }
    console.log();
}
async function deleteConfig() {
    console.log();
    const confirm = await promptInput(chalk.yellow('  Delete API key? This cannot be undone. [y/N] '));
    if (confirm.toLowerCase() !== 'y') {
        console.log(chalk.gray('  Cancelled.'));
        return;
    }
    try {
        await unlink(CONFIG_PATH);
        console.log(chalk.green('  API key deleted'));
    }
    catch {
        console.log(chalk.yellow('  No config file to delete'));
    }
    console.log();
}
async function showPath() {
    console.log();
    console.log(chalk.gray('  Config file: ') + CONFIG_PATH);
    console.log();
    console.log(chalk.gray('  To edit manually:'));
    console.log(chalk.cyan(`    nano ${CONFIG_PATH}`));
    console.log();
}
export async function configCommand(options) {
    if (options.set) {
        await setApiKey();
    }
    else if (options.delete) {
        await deleteConfig();
    }
    else if (options.path) {
        await showPath();
    }
    else {
        await showConfig();
    }
}
