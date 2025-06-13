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

// This file defines the 'create-version' (alias 'version') command for the
// clasp CLI.

import {Command} from 'commander';

import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

export const command = new Command('create-version')
  .alias('version')
  .arguments('[description]')
  .description('Creates an immutable version of the script')
  .action(async function (this: Command, description?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    if (!description && isInteractive()) {
      const prompt = intl.formatMessage({
        defaultMessage: 'Give a description:',
      });
      const answer = await inquirer.prompt([
        {
          default: '',
          message: prompt,
          name: 'description',
          type: 'input',
        },
      ]);
      description = answer.description;
    }

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Creating a new version...',
    });
    const versionNumber = await withSpinner(spinnerMsg, async () => {
      return clasp.project.version(description);
    });

    const outputAsJson = this.optsWithGlobals().json ?? false;
    if (outputAsJson) {
      console.log(JSON.stringify({version: versionNumber}, null, 2));
    } else {
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Created version {version, number}`,
        },
        {
          version: versionNumber,
        },
      );
      console.log(successMessage);
    }
  });
