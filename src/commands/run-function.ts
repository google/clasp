import chalk from 'chalk';
import {Command} from 'commander';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-standalone';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {checkIfOnlineOrDie, isInteractive, withSpinner} from './utils.js';

interface CommandOption {
  readonly nondev: boolean;
  readonly params: string;
}

export const command = new Command('run-function')
  .alias('run')
  .description('Run a function in your Apps Scripts project')
  .argument('[functionName]', 'The name of the function to run')
  .option('--nondev', 'Run script function in non-devMode')
  .option('-p, --params <value>', 'Parameters to pass to the function, as a JSON-encoded array')
  .action(async function (this: Command, functionName: string, options: CommandOption): Promise<void> {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;
    const devMode = !options.nondev; // Defaults to true
    let params: unknown[] = [];

    if (options.params) {
      params = JSON.parse(options.params);
    }

    if (!functionName && isInteractive()) {
      const allFunctions = await clasp.functions.getFunctionNames();
      const source = async (input = '') =>
        fuzzy.filter(input, allFunctions).map(element => ({
          value: element.original,
        }));
      const prompt = intl.formatMessage({
        defaultMessage: 'Selection a function name',
      });
      functionName = await autocomplete({
        message: prompt,
        source,
      });
    }
    try {
      const {error, response} = await withSpinner(`Running function: ${functionName}`, async () => {
        return await clasp.functions.runFunction(functionName, params, devMode);
      });

      if (error && error.details) {
        const {errorMessage, scriptStackTraceElements} = error.details[0];
        const msg = intl.formatMessage({
          defaultMessage: 'Exception:',
        });
        console.error(`${chalk.red(msg)}`, errorMessage, scriptStackTraceElements || []);
        return;
      }

      if (response && response.result) {
        console.log(response.result);
      } else {
        const msg = intl.formatMessage({
          defaultMessage: 'No response.',
        });
        console.log(chalk.red(msg));
      }
    } catch (error) {
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        const msg = intl.formatMessage({
          defaultMessage:
            'Unable to run script function. Please make sure you have permission to run the script function.',
        });
        this.error(msg);
      }
      if (error.cause?.code === 'NOT_FOUND') {
        const msg = intl.formatMessage({
          defaultMessage: 'Script function not found. Please make sure script is deployed as API executable.',
        });
        this.error(msg);
      }
      throw error;
    }
  });
