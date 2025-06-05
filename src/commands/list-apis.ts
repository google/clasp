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
 * @fileoverview Implements the `clasp apis` or `clasp list-apis` command.
 * This command lists the Google APIs that are currently enabled for the Apps Script project
 * and also lists all available Google APIs that can be enabled.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

/**
 * Command to list both enabled and available Google APIs for the Apps Script project.
 */
export const command = new Command('list-apis')
  .alias('apis')
  .description('List enabled Google APIs for the current project and all available APIs.')
  /**
   * Action handler for the `list-apis` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Ensure a GCP project ID is configured, prompting the user if necessary.
    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    const fetchingMsg = intl.formatMessage({
      defaultMessage: 'Fetching API information...',
    });

    // Fetch both enabled and available APIs concurrently.
    const [enabledApis, availableApis] = await withSpinner(fetchingMsg, () =>
      Promise.all([clasp.services.getEnabledServices(), clasp.services.getAvailableServices()]),
    );

    // Display enabled APIs.
    const enabledApisLabel = intl.formatMessage({
      defaultMessage: '# Currently enabled APIs for project {projectId}:',
    }, {projectId: clasp.project.projectId});
    console.log(`\n${enabledApisLabel}`);
    if (enabledApis.length > 0) {
      for (const service of enabledApis) {
        console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
      }
    } else {
      console.log(intl.formatMessage({defaultMessage: '  No APIs are currently enabled.'}));
    }

    // Display available APIs.
    const availableApisLabel = intl.formatMessage({
      defaultMessage: '# List of available APIs that can be enabled:',
    });
    console.log(`\n${availableApisLabel}`);
    if (availableApis.length > 0) {
      for (const service of availableApis) {
        console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
      }
    } else {
      // This case should ideally not happen as there are always available APIs.
      console.log(intl.formatMessage({defaultMessage: '  No available APIs found.'}));
    }
  });
