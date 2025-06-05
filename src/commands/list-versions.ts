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

import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

export const command = new Command('list-versions')
  .alias('versions')
  .description('List versions of a script')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching versions...',
    });
    const versions = await withSpinner(spinnerMsg, async () => {
      return await clasp.project.listVersions();
    });

    if (versions.results.length === 0) {
      const msg = intl.formatMessage({
        defaultMessage: 'No deployed versions of script.',
      });
      this.error(msg);
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
