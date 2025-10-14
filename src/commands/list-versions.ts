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

// This file defines the 'list-versions' (alias 'versions') command for the
// clasp CLI.

import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {}

export const command = new Command('list-versions')
  .alias('versions')
  .description('List versions of a script')
  .argument('[scriptId]', 'Apps Script ID to list deployments for')
  .action(async function (this: Command, scriptId?: string): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;
    if (scriptId) {
      clasp.withScriptId(scriptId);
    }
    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching versions...',
    });
    const versions = await withSpinner(spinnerMsg, () => clasp.project.listVersions());

    if (options.json) {
      const versionOutput = versions.results.map(version => ({
        versionNumber: version.versionNumber,
        description: version.description,
      }));
      console.log(JSON.stringify(versionOutput, null, 2));
      return;
    }

    if (!versions.results?.length) {
      const msg = intl.formatMessage({
        defaultMessage: 'No deployed versions of script.',
      });
      console.log(msg);
      return;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# version} other {# versions}}.',
      },
      {
        count: versions.results.length,
      },
    );
    console.log(successMessage);

    versions.results.reverse();
    versions.results.forEach(version => {
      const msg = intl.formatMessage(
        {
          defaultMessage: '{version, number} - {description, select, undefined {No description} other {{description}}}',
        },
        {
          version: version.versionNumber,
          description: version.description,
        },
      );
      console.log(msg);
    });
  });
