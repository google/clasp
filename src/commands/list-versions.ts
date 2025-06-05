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
 * @fileoverview Implements the `clasp versions` or `clasp list-versions` command.
 * This command lists all immutable versions of an Apps Script project,
 * along with their version numbers and descriptions.
 */

import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * Command to list all immutable versions of an Apps Script project.
 * Displays the version number and description for each version.
 */
export const command = new Command('list-versions')
  .alias('versions')
  .description('List an Apps Script project\'s immutable versions.')
  /**
   * Action handler for the `list-versions` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const fetchingMsg = intl.formatMessage({
      defaultMessage: 'Fetching versions...',
    });
    // Retrieve all versions for the project.
    const versionsResponse = await withSpinner(fetchingMsg, async () => {
      return clasp.project.listVersions();
    });

    if (versionsResponse.results.length === 0) {
      const noVersionsMsg = intl.formatMessage({
        defaultMessage: 'No versions found for this script.',
      });
      this.error(noVersionsMsg); // Error out if no versions exist, as it's unusual.
    }

    const foundMsg = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# version} other {# versions}} for project {scriptId}:',
      },
      {
        count: versionsResponse.results.length,
        scriptId: clasp.project.scriptId,
      },
    );
    console.log(foundMsg);

    // Display versions in reverse chronological order (newest first).
    versionsResponse.results.reverse();
    versionsResponse.results.forEach(version => {
      const description = version.description ?? intl.formatMessage({defaultMessage: 'No description'});
      const versionNumStr = version.versionNumber?.toString() ?? 'N/A';
      console.log(`${versionNumStr.padStart(4)} - ${description}`);
    });
  });
