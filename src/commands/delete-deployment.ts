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

// This file defines the 'delete-deployment' (alias 'undeploy') command for
// the clasp CLI.

import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly all?: boolean;
}

export const command = new Command('delete-deployment')
  .alias('undeploy')
  .description('Delete a deployment of a project')
  .arguments('[deploymentId]')
  .option('-a, --all', 'Undeploy all deployments')
  .action(async function (this: Command, deploymentId: string | undefined) {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const removeAll = options.all;
    const deletedDeploymentIds: string[] = [];

    const deleteDeployment = async (id: string) => {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Deleting deployment...',
      });
      await withSpinner(spinnerMsg, async () => {
        return clasp.project.undeploy(id);
      });
      deletedDeploymentIds.push(id);
      if (!options.json) {
        const successMessage = intl.formatMessage(
          {
            defaultMessage: 'Deleted deployment {id}',
          },
          {id},
        );
        console.log(successMessage);
      }
    };

    if (removeAll) {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Fetching deployments...',
      });
      const deployments = await withSpinner(spinnerMsg, async () => {
        return await clasp.project.listDeployments();
      });

      deployments.results = deployments.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined,
      );
      for (const deployment of deployments.results) {
        const id = deployment.deploymentId;
        if (!id) {
          continue;
        }
        await deleteDeployment(id);
      }

      if (options.json) {
        console.log(JSON.stringify({deletedDeploymentIds}, null, 2));
        return;
      }

      const successMessage = intl.formatMessage({
        defaultMessage: `Deleted all deployments.`,
      });
      console.log(successMessage);
      return;
    }

    if (!deploymentId) {
      const deployments = await clasp.project.listDeployments();
      deployments.results = deployments.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined,
      );

      if (deployments.results.length === 1) {
        deploymentId = deployments.results[0].deploymentId ?? undefined;
      } else if (isInteractive()) {
        const prompt = intl.formatMessage({
          defaultMessage: 'Delete which deployment?',
        });
        const choices = deployments.results.map(deployment => ({
          name: `${deployment.deploymentId} - ${deployment.deploymentConfig?.description ?? ''}`,
          value: deployment.deploymentId,
        }));
        const answer = await inquirer.prompt([
          {
            choices: choices,
            message: prompt,
            name: 'deploymentId',
            pageSize: 30,
            type: 'list',
          },
        ]);
        deploymentId = answer.deploymentId;
      }
    }

    if (!deploymentId) {
      if (options.json) {
        console.log(JSON.stringify({deletedDeploymentIds: []}, null, 2));
        return;
      }

      const msg = intl.formatMessage({
        defaultMessage: `No deployments found.`,
      });
      this.error(msg);
    }

    await deleteDeployment(deploymentId);
    if (options.json) {
      console.log(JSON.stringify({deletedDeploymentIds}, null, 2));
    }
  });
