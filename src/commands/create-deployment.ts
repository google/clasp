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
 * @fileoverview Implements the `clasp deploy` command, which allows users to
 * create new deployments or update existing ones for an Apps Script project.
 * Users can specify a version number and a description for the deployment.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `deploy` command.
 */
interface CommandOption {
  /** The version number of the script to deploy. If not specified, a new version is created. */
  readonly versionNumber?: number;
  /** A description for the deployment. */
  readonly description?: string;
  /** The ID of an existing deployment to update. If not specified, a new deployment is created. */
  readonly deploymentId?: string;
}

/**
 * Command to create or update a deployment for an Apps Script project.
 */
export const command = new Command('create-deployment')
  .alias('deploy')
  .description('Deploy a project')
  .option('-V, --versionNumber <version>', 'The project version to deploy. If not specified, a new version is created.')
  .option('-d, --description <description>', 'The description for this deployment or new version.')
  .option('-i, --deploymentId <id>', 'The ID of the deployment to update. If not specified, a new deployment is created.')
  /**
   * Action handler for the `deploy` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const {deploymentId, description: optionDescription, versionNumber: optionVersionNumber} = options;

    // Use provided description or default to empty string.
    const description = optionDescription ?? '';
    // Convert versionNumber to a number if provided.
    const versionNumber = optionVersionNumber ? Number(optionVersionNumber) : undefined;

    try {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: deploymentId ? 'Updating deployment...' : 'Deploying project...',
      });
      // The clasp.project.deploy method handles both creating a new deployment (if deploymentId is undefined)
      // and updating an existing one (if deploymentId is provided).
      // If versionNumber is undefined, it will also create a new version of the script.
      const deployment = await withSpinner(spinnerMsg, async () => {
        return clasp.project.deploy(description, deploymentId, versionNumber);
      });

      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Deployed {deploymentId} {version, select,
            undefined {@HEAD}
            other {@{versionNumber}}
          }`,
        },
        {
          deploymentId: deployment.deploymentId,
          // Use versionNumber from deploymentConfig if available, otherwise indicates HEAD or latest.
          versionNumber: deployment.deploymentConfig?.versionNumber,
        },
      );
      console.log(successMessage);
    } catch (error) {
      // Handle specific API errors or rethrow for global error handling.
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        // This can happen if the scriptId is invalid, deploymentId is not found, etc.
        this.error(error.cause.message);
      }
      throw error;
    }
  });
