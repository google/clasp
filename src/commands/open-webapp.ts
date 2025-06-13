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

// This file defines the 'open-web-app' command for the clasp CLI.

import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {ellipsize, isInteractive, openUrl} from './utils.js';

export const command = new Command('open-web-app')
  .arguments('[deploymentId]')
  .description('Open a deployed web app in the browser.')
  .action(async function (this: Command, deploymentId?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const scriptId = clasp.project.scriptId;
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to open web app.',
      });
      this.error(msg);
    }

    if (!deploymentId && isInteractive()) {
      const deployments = await clasp.project.listDeployments();
      // Order deployments by update time.
      deployments.results.sort((a, b) => (a.updateTime && b.updateTime ? a.updateTime.localeCompare(b.updateTime) : 0));
      const choices = deployments.results.map(deployment => {
        const description = ellipsize(deployment.deploymentConfig?.description ?? '', 30);
        const versionNumber = (deployment.deploymentConfig?.versionNumber?.toString() ?? 'HEAD').padEnd(4);
        const name = `${description}@${versionNumber}} - ${deployment.deploymentId}`;
        return {
          name: name,
          value: deployment.deploymentId,
        };
      });

      const prompt = intl.formatMessage({
        defaultMessage: 'Open which deployment?',
      });
      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: prompt,
          name: 'deployment',
          type: 'list',
        },
      ]);

      deploymentId = answer.deployment;
    }

    if (!deploymentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Deployment ID is required.',
      });
      this.error(msg);
    }

    const entryPoints = (await clasp.project.entryPoints(deploymentId)) ?? [];

    const webAppEntry = entryPoints.find(entryPoint => {
      return entryPoint.entryPointType === 'WEB_APP' && !!entryPoint.webApp?.url;
    });

    if (!webAppEntry || !webAppEntry.webApp?.url) {
      const msg = intl.formatMessage({
        defaultMessage: 'No web app entry point found.',
      });
      this.error(msg);
    }

    const url = new URL(webAppEntry.webApp.url);
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    const finalUrl = url.toString();
    await openUrl(finalUrl);

    const outputAsJson = this.optsWithGlobals().json ?? false;
    if (outputAsJson) {
      console.log(JSON.stringify({url: finalUrl}, null, 2));
    }
  });
