// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Implements the `clasp run` or `clasp run-function` command.
 * This command allows users to execute a specified Apps Script function remotely
 * from the command line. It supports passing parameters to the function and
 * running in either development or production (non-dev) mode.
 */

import chalk from 'chalk';
import {Command} from 'commander';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-standalone';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `run-function` command.
 */
interface CommandOption {
  /** If true, runs the function in non-development (production) mode. */
  readonly nondev: boolean;
  /** A JSON string representing an array of parameters to pass to the function. */
  readonly params: string;
}

/**
 * Command to execute an Apps Script function remotely.
 * Allows specifying the function name, parameters, and execution mode (dev/non-dev).
 */
export const command = new Command('run-function')
  .alias('run')
  .description('Execute an Apps Script function remotely.')
  .argument('[functionName]', 'The name of the function in the Apps Script project to run.')
  .option('--nondev', 'Run the script function in production mode (not dev mode). Dev mode is default.')
  .option('-p, --params <jsonArray>', 'Parameters to pass to the function, as a JSON-encoded array (e.g., \'["param1", 2]\').')
  /**
   * Action handler for the `run-function` command.
   * @param functionNameToRun The name of the function to execute.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, functionNameToRun: string, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const devMode = !options.nondev; // `nondev` option means `devMode` is false. Defaults to devMode=true.
    let parameters: unknown[] = [];
    let functionToExecute = functionNameToRun;

    // Parse parameters if provided.
    if (options.params) {
      try {
        parameters = JSON.parse(options.params);
        if (!Array.isArray(parameters)) {
          this.error('Error: Parameters must be a JSON array. Example: \'["param1", 2]\'');
        }
      } catch (error) {
        this.error(`Error parsing parameters: ${error.message}. Ensure it's a valid JSON array.`);
      }
    }

    // If no function name is provided and in interactive mode, prompt the user.
    if (!functionToExecute && isInteractive()) {
      const allFunctions = await clasp.functions.getFunctionNames();
      if (allFunctions.length === 0) {
        this.error('No functions found in this Apps Script project.');
      }
      const fuzzySource = async (_answersSoFar: unknown, input = '') =>
        fuzzy.filter(input, allFunctions).map(element => ({
          name: element.original, // `name` is shown in the list
          value: element.original, // `value` is returned on selection
        }));

      const promptMessage = intl.formatMessage({
        defaultMessage: 'Select a function to run:',
      });
      functionToExecute = await autocomplete({
        message: promptMessage,
        source: fuzzySource,
      });
    }

    if (!functionToExecute) {
      this.error('No function name provided. Please specify a function to run or use interactive mode.');
    }

    try {
      const runningMsg = intl.formatMessage(
        {defaultMessage: 'Running function: {functionName}...'},
        {functionName: functionToExecute},
      );
      // Execute the function using the clasp library.
      const {error: executionError, response} = await withSpinner(
        runningMsg,
        async () => clasp.functions.runFunction(functionToExecute, parameters, devMode),
      );

      if (executionError?.details) {
        // Handle structured errors from the Apps Script API.
        const {errorMessage, scriptStackTraceElements} = executionError.details[0];
        const errorLabel = intl.formatMessage({defaultMessage: 'Exception:'});
        console.error(`${chalk.red(errorLabel)}`, errorMessage);
        if (scriptStackTraceElements && scriptStackTraceElements.length > 0) {
          scriptStackTraceElements.forEach(trace => {
            console.error(`    at ${trace.function || 'unknown'}${trace.lineNumber ? `:${trace.lineNumber}` : ''}`);
          });
        }
        return;
      }

      if (response?.result !== undefined) {
        console.log(response.result);
      } else if (!executionError) { // If no error but also no result, it might be an empty/undefined return.
        const noResponseMsg = intl.formatMessage({
          defaultMessage: 'Function executed successfully, but returned no result or an undefined result.',
        });
        console.log(chalk.yellow(noResponseMsg));
      }
      // If executionError exists but has no details, it will be caught by the outer catch block.
    } catch (error) {
      // Handle other errors, including those from clasp library or API issues not caught above.
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        const msg = intl.formatMessage({
          defaultMessage: 'Error: Not authorized to run the script function. Please check your permissions.',
        });
        this.error(msg);
      }
      if (error.cause?.code === 'NOT_FOUND') {
        const msg = intl.formatMessage(
          {defaultMessage: 'Error: Script function "{functionName}" not found. Ensure it is correctly named and the script is deployed as an API executable if required.'},
          {functionName: functionToExecute},
        );
        this.error(msg);
      }
      // Rethrow for global error handling if not specifically handled here.
      throw error;
    }
  });
