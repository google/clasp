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
 * @fileoverview Implements the `clasp deployments` or `clasp list-deployments` command.
 * This command lists all deployments for an Apps Script project, including their
 * deployment ID, version, and description.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * Command to list all deployments of an Apps Script project.
 * Displays deployment ID, version, and description for each deployment.
 */
export const command = new Command('list-deployments')
  .alias('deployments')
  .description('List deployment IDs and details of a script project.')
  /**
   * Action handler for the `list-deployments` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const fetchingMsg = intl.formatMessage({
      defaultMessage: 'Fetching deployments...',
    });
    // Retrieve all deployments for the project.
    const deploymentsResponse = await withSpinner(fetchingMsg, async () => {
      return clasp.project.listDeployments();
    });

    if (!deploymentsResponse.results.length) {
      const noDeploymentsMsg = intl.formatMessage({
        defaultMessage: 'No deployments found for this project.',
      });
      console.log(noDeploymentsMsg);
      return;
    }

    const foundMsg = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# deployment} other {# deployments}} for project {scriptId}:',
      },
      {
        count: deploymentsResponse.results.length,
        scriptId: clasp.project.scriptId,
      },
    );
    console.log(foundMsg);

    // Filter out any deployments that might be missing essential config or ID, then display them.
    deploymentsResponse.results
      .filter(deployment => deployment.deploymentConfig && deployment.deploymentId)
      .forEach(deployment => {
        // Determine if the deployment is for a specific version or HEAD.
        const versionString = deployment.deploymentConfig?.versionNumber
          ? `@${deployment.deploymentConfig.versionNumber}`
          : '@HEAD';
        // Include description if available.
        const description = deployment.deploymentConfig?.description ? `- ${deployment.deploymentConfig.description}` : '';
        console.log(`- ${deployment.deploymentId} ${versionString} ${description}`);
      });
  });
