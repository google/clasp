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
 * @fileoverview Implements the `clasp enable-api` command, which allows users
 * to enable a Google API for their Apps Script project. This involves adding
 * the service to the script's manifest and enabling it in the associated
 * Google Cloud Platform (GCP) project.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

/**
 * Command to enable a Google API for the current Apps Script project.
 * It updates the script manifest and enables the service in the linked GCP project.
 */
export const command = new Command('enable-api')
  .description('Enable a Google API service for the current Apps Script project.')
  .argument('<api>', 'The name of the API service to enable (e.g., "sheets", "drive").')
  /**
   * Action handler for the `enable-api` command.
   * @param serviceName The name of the service to enable.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, serviceName: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Ensure a GCP project ID is configured, prompting the user if necessary.
    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    try {
      const enablingMsg = intl.formatMessage(
        {defaultMessage: 'Enabling API {serviceName}...'},
        {serviceName},
      );
      await withSpinner(enablingMsg, async () => {
        // Core logic to enable the service (updates manifest and GCP settings).
        await clasp.services.enableService(serviceName);
      });
    } catch (error) {
      // Handle specific error from the services.enableService call.
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        const msg = intl.formatMessage(
          {
            defaultMessage: 'Error: You are not authorized to enable the {name} API, or it may not exist. Please check your permissions and the API name.',
          },
          {
            name: serviceName,
          },
        );
        this.error(msg);
      }
      // Rethrow other errors to be handled by the global error handler.
      throw error;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Enabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
