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

// This file defines the 'run-function' (alias 'run') command for the clasp CLI.

import chalk from 'chalk';
import {Command} from 'commander';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-standalone';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly nondev: boolean;
  readonly params: string;
}

export const command = new Command('run-function')
  .alias('run')
  .description('Run a function in your Apps Scripts project')
  .argument('[functionName]', 'The name of the function to run')
  .option('--nondev', 'Run script function in non-devMode')
  .option('-p, --params <value>', 'Parameters to pass to the function, as a JSON-encoded array')
  .action(async function (this: Command, functionName: string): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const devMode = !options.nondev; // Defaults to true
    let params: unknown[] = [];

    if (options.params) {
      // Parameters for the function are expected to be a JSON-encoded array.
      params = JSON.parse(options.params);
    }

    // If no function name is provided and the session is interactive,
    // fetch all function names from the project and prompt the user to select one.
    if (!functionName && isInteractive()) {
      const allFunctions = await clasp.functions.getFunctionNames();
      // `inquirer-autocomplete-standalone` provides a fuzzy-searchable list.
      const source = async (input = '') =>
        fuzzy.filter(input, allFunctions).map(element => ({
          value: element.original, // The original function name is the value.
        }));
      const prompt = intl.formatMessage({
        defaultMessage: 'Selection a function name',
      });
      functionName = await autocomplete({
        message: prompt,
        source, // Source function for the autocomplete.
      });
    }

    // Attempt to run the function.
    try {
      // `clasp.functions.runFunction` calls the Apps Script API.
      const result = await withSpinner(`Running function: ${functionName}`, async () => {
        return clasp.functions.runFunction(functionName, params, devMode);
      });

      if (options.json) {
        const output = {
          response: result.response?.result,
          error: result.error
            ? {
                code: result.error.code,
                message: result.error.message,
                details: result.error.details,
              }
            : undefined,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Handle the API response.
      if (result.error && result.error.details) {
        // If the API returned an error in the `error.details` field (common for script execution errors).
        const {errorMessage, scriptStackTraceElements} = result.error.details[0];
        const msg = intl.formatMessage({
          defaultMessage: 'Exception:',
        });
        console.error(`${chalk.red(msg)}`, errorMessage, scriptStackTraceElements || []);
        return;
      }

      if (result.response && result.response.result !== undefined) {
        // If the function executed successfully and returned a result.
        console.log(result.response.result);
      } else {
        // If the function execution didn't produce a result or an error in the expected format.
        const msg = intl.formatMessage({
          defaultMessage: 'No response.',
        });
        console.log(chalk.red(msg));
      }
    } catch (error) {
      // Handle errors thrown by `clasp.functions.runFunction` or other issues.
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        // Specific error for lack of permissions.
        const msg = intl.formatMessage({
          defaultMessage:
            'Unable to run script function. Please make sure you have permission to run the script function.',
        });
        this.error(msg);
      }
      if (error.cause?.code === 'NOT_FOUND') {
        // Specific error if the function or script (as API executable) is not found.
        const msg = intl.formatMessage({
          defaultMessage: 'Script function not found. Please make sure script is deployed as API executable.',
        });
        this.error(msg);
      }
      // Re-throw other errors to be caught by the global error handler.
      throw error;
    }
  });
