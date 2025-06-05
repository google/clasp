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
 * @fileoverview Implements the `clasp setup-logs` command.
 * This command ensures that the Apps Script project is linked to a Google Cloud Platform (GCP)
 * project, which is a prerequisite for viewing logs in Cloud Logging.
 * Apps Script automatically sends logs to Cloud Logging if a GCP project is associated.
 * This command effectively guides the user to set up this association if it's not already present.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, isInteractive, maybePromptForProjectId} from './utils.js';

/**
 * Command to guide the user through setting up Cloud Logging for their Apps Script project.
 * This primarily involves ensuring a Google Cloud Platform (GCP) project is linked.
 */
export const command = new Command('setup-logs')
  .description('Guides you to set up Cloud Logging for your Apps Script project.')
  /**
   * Action handler for the `setup-logs` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Prompt for GCP project ID if not already set in .clasp.json and in interactive mode.
    if (!clasp.project.projectId && isInteractive()) {
      await maybePromptForProjectId(clasp);
    }

    // Ensure that a GCP project ID is now configured.
    // This function will throw an error and exit if no project ID is set.
    assertGcpProjectConfigured(clasp);

    // If assertGcpProjectConfigured passes, it means a GCP project is linked.
    // Apps Script automatically sends logs to Cloud Logging when a project is linked.
    // Therefore, no further API calls are typically needed by this command itself to "enable" logging.
    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Cloud Logging is set up for project {projectId}. Your Apps Script logs should now be available in the Google Cloud Console.',
      },
      {projectId: clasp.project.projectId}, // projectId is asserted to exist by assertGcpProjectConfigured
    );
    console.log(successMessage);
    console.log(intl.formatMessage({defaultMessage: 'You can view them by running: clasp open-logs'}));
  });
