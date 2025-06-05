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
 * @fileoverview Implements the `clasp open-logs` command, which opens
 * the Google Cloud Platform (GCP) Cloud Logs viewer for the current
 * Apps Script project in the user's default web browser.
 * The logs are pre-filtered to show only those from Apps Script functions.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

/**
 * Command to open the Google Cloud Platform (GCP) Cloud Logs viewer for the current Apps Script project,
 * filtered for Apps Script function logs.
 */
export const command = new Command('open-logs')
  .description('Open the Google Cloud Platform Logs viewer for the current project, filtered for Apps Script.')
  /**
   * Action handler for the `open-logs` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Ensure a GCP project ID is configured, prompting the user if necessary.
    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    // Construct the URL to the GCP Cloud Logs viewer.
    const logsUrl = new URL('https://console.cloud.google.com/logs/viewer');
    logsUrl.searchParams.set('project', projectId ?? ''); // projectId is asserted by assertGcpProjectConfigured
    // Pre-filter logs to show only those from "app_script_function" resources.
    logsUrl.searchParams.set('resource', 'app_script_function');

    // Optionally include user hint for account selection in the browser.
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      if (userHint) {
        logsUrl.searchParams.set('authUser', userHint);
      }
    }

    // Open the constructed URL in the default browser.
    await openUrl(logsUrl.toString());
  });
