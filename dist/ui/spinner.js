import ora from 'ora';
import chalk from 'chalk';
export class Spinner {
    spinner = null;
    start(text) {
        this.spinner = ora({
            text: chalk.cyan(text),
            spinner: 'dots',
        }).start();
    }
    update(text) {
        if (this.spinner) {
            this.spinner.text = chalk.cyan(text);
        }
    }
    succeed(text) {
        if (this.spinner) {
            this.spinner.succeed(text ? chalk.green(text) : undefined);
            this.spinner = null;
        }
    }
    fail(text) {
        if (this.spinner) {
            this.spinner.fail(text ? chalk.red(text) : undefined);
            this.spinner = null;
        }
    }
    stop() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }
    info(text) {
        if (this.spinner) {
            this.spinner.info(chalk.blue(text));
            this.spinner = null;
        }
    }
}
export const spinner = new Spinner();
