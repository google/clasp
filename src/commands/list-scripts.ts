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
 * @fileoverview Implements the `clasp list` or `clasp list-scripts` command.
 * This command lists all Apps Script projects accessible to the authenticated user,
 * displaying their names and URLs to the script editor.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {ellipsize, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `list-scripts` command.
 */
interface CommandOption {
  /** Whether to prevent shortening of long script names in the output. */
  readonly noShorten: boolean;
}

/**
 * Command to list Apps Script projects accessible to the user.
 * Displays the script name (optionally shortened) and a URL to the script editor.
 */
export const command = new Command('list-scripts')
  .alias('list')
  .description('List your Apps Script projects.')
  .option('--noShorten', 'Do not shorten long project names in the output.', false)
  /**
   * Action handler for the `list-scripts` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const findingMsg = intl.formatMessage({
      defaultMessage: 'Finding your Apps Script projects...',
    });
    // Fetch the list of script projects.
    const scriptListResponse = await withSpinner(findingMsg, async () => {
      return clasp.project.listScripts();
    });

    if (!scriptListResponse.results.length) {
      const noScriptsMsg = intl.formatMessage({
        defaultMessage: 'No script projects found.',
      });
      console.log(noScriptsMsg);
      return;
    }

    const foundMsg = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# script project} other {# script projects}}:',
      },
      {
        count: scriptListResponse.results.length,
      },
    );
    console.log(foundMsg);

    // Display each script with its name and URL.
    scriptListResponse.results.forEach(script => {
      // Shorten long names unless --noShorten is specified.
      const name = options.noShorten ? script.name! : ellipsize(script.name!, 20);
      const url = `https://script.google.com/d/${script.id}/edit`;
      console.log(`${name} - ${url}`);
    });
  });
