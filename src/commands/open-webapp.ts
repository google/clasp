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
 * @fileoverview Implements the `clasp open-web-app` command, which opens
 * a deployed web app for the current Apps Script project in the user's
 * default web browser. If multiple deployments exist, it can prompt the user
 * to select one.
 */

import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {ellipsize, isInteractive, openUrl} from './utils.js';

/**
 * Command to open a deployed Apps Script web app in the browser.
 * If a deployment ID is not provided and multiple deployments exist,
 * it prompts the user to select a deployment.
 */
export const command = new Command('open-web-app')
  .arguments('[deploymentId]')
  .description('Open a deployed web app in the default browser.')
  /**
   * Action handler for the `open-web-app` command.
   * @param deploymentIdOptional Optional ID of the deployment to open.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, deploymentIdOptional?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    let deploymentId = deploymentIdOptional;

    // Ensure the project has a script ID.
    const scriptId = clasp.project.scriptId;
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not found. Please ensure you are in a clasp project or specify a script ID.',
      });
      this.error(msg);
    }

    // If deploymentId is not provided and in interactive mode, prompt the user to select one.
    if (!deploymentId && isInteractive()) {
      const deploymentsResponse = await clasp.project.listDeployments();
      const deployments = deploymentsResponse.results;

      if (deployments.length === 0) {
        this.error(intl.formatMessage({defaultMessage: 'No deployments found for this project.'}));
      }

      // Sort deployments by update time, most recent first, for better user experience.
      deployments.sort((a, b) => (b.updateTime ?? '').localeCompare(a.updateTime ?? ''));

      const choices = deployments.map(deployment => {
        const desc = ellipsize(deployment.deploymentConfig?.description ?? 'No description', 30);
        const version = (deployment.deploymentConfig?.versionNumber?.toString() ?? 'HEAD').padEnd(4);
        // Provide a user-friendly name for each choice.
        const choiceName = `${desc} @${version} - ${deployment.deploymentId}`;
        return {
          name: choiceName,
          value: deployment.deploymentId,
        };
      });

      const promptMsg = intl.formatMessage({
        defaultMessage: 'Select a web app deployment to open:',
      });
      const answers = await inquirer.prompt([
        {
          choices,
          message: promptMsg,
          name: 'deploymentId', // Store the selected deployment ID.
          type: 'list',
        },
      ]);
      deploymentId = answers.deploymentId;
    }

    // If still no deploymentId (e.g., not interactive and none provided), error out.
    if (!deploymentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Deployment ID is required. Please specify a deployment ID or run in interactive mode to choose.',
      });
      this.error(msg);
    }

    // Fetch entry points for the selected deployment to find the web app URL.
    const entryPoints = (await clasp.project.entryPoints(deploymentId!)) ?? []; // deploymentId is checked above.

    const webAppEntry = entryPoints.find(
      entryPoint => entryPoint.entryPointType === 'WEB_APP' && entryPoint.webApp?.url,
    );

    if (!webAppEntry?.webApp?.url) {
      const msg = intl.formatMessage(
        {defaultMessage: 'No web app URL found for deployment ID: {deploymentId}. Ensure it is a web app deployment.'},
        {deploymentId},
      );
      this.error(msg);
    }

    // Construct and open the web app URL.
    const webAppUrl = new URL(webAppEntry.webApp.url);
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      if (userHint) {
        webAppUrl.searchParams.set('authUser', userHint);
      }
    }
    await openUrl(webAppUrl.toString());
  });
