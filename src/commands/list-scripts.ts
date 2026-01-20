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

// This file defines the 'list-scripts' (alias 'list') command for the clasp
// CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, ellipsize, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly noShorten: boolean;
}

export const command = new Command('list-scripts')
  .alias('list')
  .description('List Apps Script projects')
  .option('--noShorten', 'Do not shorten long names', false)
  .action(async function (this: Command): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Finding your scripts...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      return clasp.project.listScripts();
    });

    if (options.json) {
      const scripts = files.results.map(file => ({
        id: file.id,
        name: file.name,
      }));
      console.log(JSON.stringify(scripts, null, 2));
      return;
    }

    if (!files.results.length) {
      const msg = intl.formatMessage({
        defaultMessage: 'No script files found.',
      });
      console.log(msg);
      return;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# script} other {# scripts}}.',
      },
      {
        count: files.results.length,
      },
    );
    console.log(successMessage);
    files.results.forEach(file => {
      const name = options.noShorten ? file.name! : ellipsize(file.name!, 20);
      const url = `https://script.google.com/d/${file.id}/edit`;
      console.log(`${name} - ${url}`);
    });
  });
