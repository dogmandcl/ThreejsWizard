import { homedir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import chalk from 'chalk';
import { MODEL_MAP, DEFAULT_MODEL } from '../core/types.js';
const CONFIG_DIR = join(homedir(), '.threewzrd');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const VALID_MODELS = ['sonnet', 'opus', 'haiku', 'opus-4.5', 'opus-4.6'];
async function loadConfig() {
    try {
        const content = await readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
async function saveConfig(config) {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}
export async function modelCommand(name) {
    console.log();
    if (!name) {
        // Show current model
        const config = await loadConfig();
        const currentModel = config.model || DEFAULT_MODEL;
        console.log(chalk.cyan('  Model Configuration'));
        console.log(chalk.gray('  ─────────────────────────────────────────'));
        console.log();
        console.log(chalk.gray('  Current default: ') + chalk.green(currentModel));
        console.log(chalk.gray('  Model ID: ') + chalk.gray(MODEL_MAP[currentModel]));
        console.log();
        console.log(chalk.gray('  Available models:'));
        for (const model of VALID_MODELS) {
            const marker = model === currentModel ? chalk.green(' (default)') : '';
            console.log(chalk.gray('    - ') + chalk.white(model) + marker);
        }
        console.log();
        console.log(chalk.gray('  To change: ') + chalk.cyan('threewzrd model <name>'));
        console.log();
        return;
    }
    // Set model
    const modelName = name.toLowerCase();
    if (!VALID_MODELS.includes(modelName)) {
        console.log(chalk.red(`  Unknown model: ${name}`));
        console.log();
        console.log(chalk.gray('  Valid models:'));
        for (const model of VALID_MODELS) {
            console.log(chalk.gray('    - ') + chalk.white(model));
        }
        console.log();
        return;
    }
    const config = await loadConfig();
    config.model = modelName;
    await saveConfig(config);
    console.log(chalk.green(`  Default model set to: ${modelName}`));
    console.log(chalk.gray(`  Model ID: ${MODEL_MAP[modelName]}`));
    console.log();
}
