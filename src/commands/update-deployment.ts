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
 * @fileoverview Implements the `clasp redeploy` or `clasp update-deployment` command.
 * This command allows users to update an existing deployment of an Apps Script project
 * to a new version or with a new description.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `update-deployment` command.
 * Note: `deploymentId` is passed as a direct argument to the action handler, not as an option.
 */
interface CommandOption {
  /** The new version number to associate with the deployment. If not specified, deploys HEAD. */
  readonly versionNumber?: number;
  /** The new description for the deployment. */
  readonly description?: string;
  /** The ID of the deployment to update. This is marked optional here as it's handled by commander's argument parsing. */
  readonly deploymentId?: string;
}

/**
 * Command to update an existing deployment of an Apps Script project.
 * Users must specify the deployment ID to update. They can optionally provide
 * a new version number and/or a new description.
 */
export const command = new Command('update-deployment')
  .alias('redeploy') // Common alias for updating a deployment.
  .argument('<deploymentId>', 'The ID of the deployment to update.')
  .description('Updates an existing deployment of the project, optionally changing its version or description.')
  .option('-V, --versionNumber <version>', 'The script version to deploy. If not specified, the current HEAD of the script is deployed.')
  .option('-d, --description <description>', 'A new description for this deployment.')
  /**
   * Action handler for the `update-deployment` command.
   * @param deploymentIdToUpdate The ID of the deployment to update.
   * @param options The command options including versionNumber and description.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, deploymentIdToUpdate: string, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    // Description defaults to empty string if not provided, which will clear it on the deployment if it previously had one.
    const description = options.description ?? '';
    // Convert versionNumber to a number if provided.
    const versionNumber = options.versionNumber ? Number(options.versionNumber) : undefined;

    // Commander should enforce the deploymentId argument, but a runtime check is good practice.
    if (!deploymentIdToUpdate) {
      const msg = intl.formatMessage({
        defaultMessage: 'Deployment ID is required to update a deployment. Please provide a valid deployment ID.',
      });
      this.error(msg); // Exits the command.
    }

    try {
      const updatingMsg = intl.formatMessage(
        {defaultMessage: 'Updating deployment {deploymentId}...'},
        {deploymentId: deploymentIdToUpdate},
      );
      // The `clasp.project.deploy` method handles updating an existing deployment when a deploymentId is provided.
      const deployment = await withSpinner(updatingMsg, async () => {
        return clasp.project.deploy(description, deploymentIdToUpdate, versionNumber);
      });

      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Successfully updated deployment: {deploymentId} {version, select,
            undefined {@HEAD}
            other {@{versionNumber}}
          }`,
        },
        {
          deploymentId: deployment.deploymentId,
          versionNumber: deployment.deploymentConfig?.versionNumber,
        },
      );
      console.log(successMessage);
    } catch (error) {
      // Handle specific API errors or rethrow for global error handling.
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        this.error(error.cause.message); // E.g., deploymentId not found.
      }
      throw error;
    }
  });
