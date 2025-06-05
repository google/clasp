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
 * @fileoverview Implements the `clasp open-credentials-setup` command.
 * This command opens the Google Cloud Platform (GCP) credentials page for the
 * Apps Script project's associated GCP project in the user's default web browser.
 * This is useful for managing OAuth client IDs, API keys, and other credentials.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

/**
 * Command to open the Google Cloud Platform (GCP) credentials page
 * for the Apps Script project's linked GCP project.
 */
export const command = new Command('open-credentials-setup')
  .description("Open the Google Cloud Platform credentials page for the script's GCP project.")
  /**
   * Action handler for the `open-credentials-setup` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Ensure a GCP project ID is configured, prompting the user if necessary.
    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    // Construct the URL to the GCP credentials page for the specific project.
    const credentialsUrl = new URL('https://console.developers.google.com/apis/credentials');
    credentialsUrl.searchParams.set('project', projectId ?? ''); // projectId is asserted by assertGcpProjectConfigured

    // Optionally include user hint for account selection in the browser.
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      if (userHint) {
        credentialsUrl.searchParams.set('authUser', userHint);
      }
    }

    // Open the constructed URL in the default browser.
    await openUrl(credentialsUrl.toString());
  });
