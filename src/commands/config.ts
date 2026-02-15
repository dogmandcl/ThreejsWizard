import { homedir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import * as readline from 'readline';
import chalk from 'chalk';

const CONFIG_DIR = join(homedir(), '.threewzrd');
const CONFIG_PATH = join(CONFIG_DIR, '.env');

async function promptInput(question: string, masked = false): Promise<string> {
  if (!masked) {
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

  // Masked input for sensitive data
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);

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

      // Regular character
      if (code >= 32 && code <= 126) {
        input += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function showConfig(): Promise<void> {
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
      // Extract and mask the key (show first 7 and last 4 chars only)
      const match = content.match(/ANTHROPIC_API_KEY=(.+)/);
      if (match && match[1]) {
        const key = match[1].trim();
        const masked = key.length > 11
          ? key.substring(0, 7) + '...' + key.substring(key.length - 4)
          : '***configured***';
        console.log(chalk.gray('  API Key: ') + chalk.green(masked));
      }
    } else {
      console.log(chalk.yellow('  No API key configured'));
    }
  } catch {
    console.log(chalk.yellow('  No config file found'));
  }
  console.log();
}

async function setApiKey(): Promise<void> {
  console.log();
  const apiKey = await promptInput(chalk.magenta('  Enter new API key: '), true);

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
  } catch (error) {
    console.log(chalk.red('  Failed to save API key'));
  }
  console.log();
}

async function deleteConfig(): Promise<void> {
  console.log();
  const confirm = await promptInput(chalk.yellow('  Delete API key? This cannot be undone. [y/N] '));

  if (confirm.toLowerCase() !== 'y') {
    console.log(chalk.gray('  Cancelled.'));
    return;
  }

  try {
    await unlink(CONFIG_PATH);
    console.log(chalk.green('  API key deleted'));
  } catch {
    console.log(chalk.yellow('  No config file to delete'));
  }
  console.log();
}

async function showPath(): Promise<void> {
  console.log();
  console.log(chalk.gray('  Config file: ') + CONFIG_PATH);
  console.log();
  console.log(chalk.gray('  To edit manually:'));
  console.log(chalk.cyan(`    nano ${CONFIG_PATH}`));
  console.log();
}

interface ConfigOptions {
  set?: boolean;
  delete?: boolean;
  path?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (options.set) {
    await setApiKey();
  } else if (options.delete) {
    await deleteConfig();
  } else if (options.path) {
    await showPath();
  } else {
    await showConfig();
  }
}
