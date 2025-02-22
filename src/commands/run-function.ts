import chalk from 'chalk';
import {Command} from 'commander';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-standalone';
import {Clasp} from '../core/clasp.js';
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

      functionName = await autocomplete({
        message: 'Select a functionName',
        source,
      });
    }
    try {
      const {error, response} = await withSpinner(`Running function: ${functionName}`, async () => {
        return await clasp.functions.runFunction(functionName, params, devMode);
      });

      if (error && error.details) {
        const {errorMessage, scriptStackTraceElements} = error.details[0];
        console.error(`${chalk.red('Exception:')}`, errorMessage, scriptStackTraceElements || []);
        return;
      }
      if (response && response.result) {
        console.log(response.result);
      } else {
        console.log(chalk.red('No response.'));
      }
    } catch (error) {
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        this.error('Unable to run script function. Please make sure you have permission to run the script function.');
      }
      if (error.cause?.code === 'NOT_FOUND') {
        this.error('Script function not found. Please make sure script is deployed as API executable.');
      }
      throw error;
    }
  });
