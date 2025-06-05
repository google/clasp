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
 * @fileoverview Implements the `clasp disable-api` command, which allows users
 * to disable a Google API for their Apps Script project. This involves removing
 * the service from the script's manifest and disabling it in the associated
 * Google Cloud Platform (GCP) project.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

/**
 * Command to disable a Google API for the current Apps Script project.
 * It updates the script manifest and disables the service in the linked GCP project.
 */
export const command = new Command('disable-api')
  .description('Disable a Google API service for the current Apps Script project.')
  .argument('<api>', 'The name of the API service to disable (e.g., "sheets", "drive").')
  /**
   * Action handler for the `disable-api` command.
   * @param serviceName The name of the service to disable.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, serviceName: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Ensure a GCP project ID is configured, prompting the user if necessary.
    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    const disablingMsg = intl.formatMessage(
      {defaultMessage: 'Disabling API {serviceName}...'},
      {serviceName},
    );
    await withSpinner(disablingMsg, async () => {
      // Core logic to disable the service (updates manifest and GCP settings).
      await clasp.services.disableService(serviceName);
    });

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Disabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
