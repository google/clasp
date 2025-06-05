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
 * @fileoverview Implements the `clasp version` command, which allows users to
 * create a new, immutable version of their Apps Script project.
 * Users can optionally provide a description for the version.
 */

import {Command} from 'commander';

import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Command to create a new, immutable version of an Apps Script project.
 * Optionally accepts a description for the version.
 */
export const command = new Command('create-version')
  .alias('version')
  .arguments('[description]')
  .description('Creates an immutable version of the script. Optionally, provide a description for the version.')
  /**
   * Action handler for the `version` command.
   * @param description Optional description for the new version.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, description?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // If no description is provided and in interactive mode, prompt the user for one.
    if (!description && isInteractive()) {
      const promptMessage = intl.formatMessage({
        defaultMessage: 'Enter a description for this version (optional):',
      });
      const answers = await inquirer.prompt([
        {
          default: '', // Default to empty string if user provides no input.
          message: promptMessage,
          name: 'description',
          type: 'input',
        },
      ]);
      description = answers.description;
    }

    const creatingMsg = intl.formatMessage({
      defaultMessage: 'Creating a new version...',
    });
    // Call the core clasp library to create a new version.
    const versionNumber = await withSpinner(creatingMsg, async () => {
      return clasp.project.version(description); // Pass the (possibly empty) description.
    });

    const successMessage = intl.formatMessage(
      {
        defaultMessage: `Created version {version, number}`,
      },
      {
        version: versionNumber,
      },
    );
    console.log(successMessage);
  });
