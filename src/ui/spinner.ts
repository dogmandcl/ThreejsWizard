import ora, { Ora } from 'ora';
import chalk from 'chalk';

export class Spinner {
  private spinner: Ora | null = null;

  start(text: string): void {
    this.spinner = ora({
      text: chalk.cyan(text),
      spinner: 'dots',
    }).start();
  }

  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = chalk.cyan(text);
    }
  }

  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text ? chalk.green(text) : undefined);
      this.spinner = null;
    }
  }

  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text ? chalk.red(text) : undefined);
      this.spinner = null;
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  info(text: string): void {
    if (this.spinner) {
      this.spinner.info(chalk.blue(text));
      this.spinner = null;
    }
  }
}

export const spinner = new Spinner();
