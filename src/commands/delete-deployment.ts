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
 * @fileoverview Implements the `clasp undeploy` or `clasp delete-deployment` command.
 * This command allows users to delete one or all deployments of an Apps Script project.
 */

import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `delete-deployment` command.
 */
interface CommandOption {
  /** Whether to delete all deployments. */
  readonly all?: boolean;
}

/**
 * Command to delete one or all deployments of an Apps Script project.
 */
export const command = new Command('delete-deployment')
  .alias('undeploy')
  .description('Delete a deployment of a project. Use --all to delete all deployments.')
  .arguments('[deploymentId]')
  .option('-a, --all', 'If set, will delete all deployments of the project.')
  /**
   * Action handler for the `delete-deployment` command.
   * @param deploymentId The ID of the deployment to delete. Optional if --all is used or in interactive mode.
   * @param options The command options, including `all`.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, deploymentId: string | undefined, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const {all: removeAll} = options;

    /**
     * Helper function to delete a single deployment by its ID.
     * @param id The ID of the deployment to delete.
     */
    const deleteSingleDeployment = async (id: string): Promise<void> => {
      const deletingMsg = intl.formatMessage(
        {defaultMessage: 'Deleting deployment {id}...'},
        {id},
      );
      await withSpinner(deletingMsg, async () => {
        return clasp.project.undeploy(id);
      });
      const successMessage = intl.formatMessage(
        {
          defaultMessage: 'Deleted deployment {id}',
        },
        {id},
      );
      console.log(successMessage);
    };

    // Logic to handle deleting all deployments if the --all flag is used.
    if (removeAll) {
      const fetchingMsg = intl.formatMessage({
        defaultMessage: 'Fetching all deployments...',
      });
      const deploymentsResponse = await withSpinner(fetchingMsg, async () => {
        return clasp.project.listDeployments();
      });

      // Filter out HEAD deployments as they cannot be deleted directly via API in the same way.
      // The API typically manages HEAD deployments automatically.
      const deletableDeployments = deploymentsResponse.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined && deployment.deploymentId,
      );

      if (deletableDeployments.length === 0) {
        console.log(intl.formatMessage({defaultMessage: 'No deletable deployments found.'}));
        return;
      }

      for (const deployment of deletableDeployments) {
        // Non-null assertion for deploymentId is safe due to the filter above.
        await deleteSingleDeployment(deployment.deploymentId!);
      }
      console.log(intl.formatMessage({defaultMessage: 'Successfully deleted all deployments.'}));
      return;
    }

    // Logic for deleting a single, specific deployment.
    if (!deploymentId) {
      // If no deploymentId is provided, try to infer or prompt.
      const deploymentsResponse = await clasp.project.listDeployments();
      const deletableDeployments = deploymentsResponse.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined && deployment.deploymentId,
      );

      if (deletableDeployments.length === 0) {
        this.error(intl.formatMessage({defaultMessage: 'No deletable deployments found for this project.'}));
      } else if (deletableDeployments.length === 1) {
        // If only one deletable deployment exists, assume that's the one to delete.
        deploymentId = deletableDeployments[0].deploymentId!;
        console.log(intl.formatMessage({defaultMessage: 'One deployment found, proceeding to delete: {deploymentId}'}, {deploymentId}));
      } else if (isInteractive()) {
        // If multiple deployments exist and in interactive mode, prompt the user to choose.
        const promptMsg = intl.formatMessage({
          defaultMessage: 'Choose a deployment to delete:',
        });
        const choices = deletableDeployments.map(deployment => ({
          name: `${deployment.deploymentId} - ${deployment.deploymentConfig?.description ?? 'No description'} (v${deployment.deploymentConfig?.versionNumber})`,
          value: deployment.deploymentId,
        }));
        const answers = await inquirer.prompt([
          {
            choices: choices,
            message: prompt,
            name: 'deploymentId',
            pageSize: 30,
            type: 'list',
          },
        ]);
        deploymentId = answers.deploymentId;
      }
    }

    // Final check: if no deploymentId could be determined (e.g., not interactive, multiple options, none provided), error out.
    if (!deploymentId) {
      this.error(intl.formatMessage({defaultMessage: 'No deployment ID specified. Use --all to delete all, or run in interactive mode.'}));
    }

    await deleteSingleDeployment(deploymentId);
  });
