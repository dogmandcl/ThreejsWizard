import dotenv from 'dotenv';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import * as readline from 'readline';
import chalk from 'chalk';
import { ThreeJsWizard } from '../core/ThreeJsWizard.js';
import { ModelId } from '../core/types.js';

interface StartOptions {
  directory: string;
  model?: string;
}

const VALID_MODELS = ['sonnet', 'opus', 'haiku', 'opus-4.5', 'opus-4.6'];

async function getConfiguredModel(): Promise<ModelId | undefined> {
  try {
    const configPath = join(homedir(), '.threewzrd', 'config.json');
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (config.model && VALID_MODELS.includes(config.model)) {
      return config.model as ModelId;
    }
  } catch {
    // No config file or invalid config
  }
  return undefined;
}

function loadEnvFiles(workingDir: string): void {
  // Load from multiple locations (later ones don't override earlier)
  // 1. Current working directory
  dotenv.config({ path: join(workingDir, '.env') });
  // 2. User's home config directory
  dotenv.config({ path: join(homedir(), '.threewzrd', '.env') });
}

async function promptForApiKey(): Promise<string> {
  console.log();
  console.log(chalk.yellow('  No API key found!'));
  console.log();
  console.log(chalk.gray('  To use Three.js Wizard, you need an Anthropic API key.'));
  console.log(chalk.gray('  Get one at: ') + chalk.cyan('https://console.anthropic.com/'));
  console.log();

  // Use masked input for security
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(chalk.magenta('  Enter your API key: '));

    // Save original terminal state
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';

    const onData = (char: string) => {
      const code = char.charCodeAt(0);

      // Enter key
      if (code === 13 || code === 10) {
        stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener('data', onData);
        stdin.pause();
        stdout.write('\n');
        resolve(input.trim());
        return;
      }

      // Ctrl+C
      if (code === 3) {
        stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener('data', onData);
        stdout.write('\n');
        process.exit(1);
      }

      // Backspace
      if (code === 127 || code === 8) {
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }

      // Regular character - show asterisk
      if (code >= 32 && code <= 126) {
        input += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function saveApiKey(apiKey: string): Promise<void> {
  const configDir = join(homedir(), '.threewzrd');
  const configPath = join(configDir, '.env');

  try {
    // Create directory with restricted permissions (owner only)
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    // Write file with restricted permissions (owner read/write only)
    await writeFile(configPath, `ANTHROPIC_API_KEY=${apiKey}\n`, { mode: 0o600 });
    console.log();
    console.log(chalk.green('  API key saved securely to ') + chalk.gray(configPath));
    console.log(chalk.gray('  (permissions: owner read/write only)'));
    console.log();
  } catch (error) {
    console.log(chalk.yellow('  Could not save API key to config file.'));
    console.log(chalk.gray('  You can manually create: ') + configPath);
  }
}

export async function startCommand(options: StartOptions): Promise<void> {
  const workingDir = options.directory;

  // Always try to change to the working directory
  try {
    process.chdir(workingDir);
  } catch (error) {
    console.error(chalk.red(`Error: Could not access directory "${workingDir}"`));
    console.error(chalk.gray('Make sure the directory exists and you have permission to access it.'));
    process.exit(1);
  }

  // Load .env files from working directory and home config
  loadEnvFiles(workingDir);

  // Check for API key, prompt if missing
  if (!process.env.ANTHROPIC_API_KEY) {
    const apiKey = await promptForApiKey();

    if (!apiKey) {
      console.log();
      console.log(chalk.red('  No API key provided. Exiting.'));
      process.exit(1);
    }

    // Validate key format (basic check)
    if (!apiKey.startsWith('sk-ant-')) {
      console.log();
      console.log(chalk.yellow('  Warning: API key doesn\'t look like an Anthropic key.'));
      console.log(chalk.gray('  Expected format: sk-ant-...'));
    }

    // Set the key for this session
    process.env.ANTHROPIC_API_KEY = apiKey;

    // Offer to save it
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const shouldSave = await new Promise<boolean>((resolve) => {
      rl.question(chalk.gray('  Save this key for future sessions? ') + chalk.gray('[Y/n] '), (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        resolve(normalized !== 'n' && normalized !== 'no');
      });
    });

    if (shouldSave) {
      await saveApiKey(apiKey);
    }
  }

  // Determine which model to use (CLI flag > config > default)
  let model: ModelId | undefined;
  if (options.model) {
    if (VALID_MODELS.includes(options.model)) {
      model = options.model as ModelId;
    } else {
      console.error(chalk.red(`Invalid model: ${options.model}`));
      console.error(chalk.gray(`Valid models: ${VALID_MODELS.join(', ')}`));
      process.exit(1);
    }
  } else {
    model = await getConfiguredModel();
  }

  // Create and start the wizard
  const wizard = new ThreeJsWizard({ model });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wizard.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    wizard.stop();
    process.exit(0);
  });

  // Start the REPL
  try {
    await wizard.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
