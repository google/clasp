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

// This file defines the 'list-deployments' (alias 'deployments') command for
// the clasp CLI.

import { Command } from 'commander';
import { Clasp } from '../core/clasp.js';
import { intl } from '../intl.js';
import { withSpinner } from './utils.js';

export const command = new Command('list-deployments')
  .alias('deployments')
  .description('List deployment ids of a script')
  .argument('[scriptId]', 'Apps Script ID to list deployments for')
  .option('--json', 'Show list in JSON form')
  .action(async function (
    this: Command,
    stringId?: string,
    options?: { json: boolean }
  ): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching deployments...',
    });
    const deployments = await withSpinner(spinnerMsg, () => clasp.project.listDeployments(stringId));

    if (!deployments.results.length) {
      const msg = intl.formatMessage({
        defaultMessage: 'No deployments.',
      });
      console.log(msg);
      return;
    }
    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# deployment} other {# deployments}}.',
      },
      {
        count: deployments.results.length,
      },
    );
    console.log(successMessage);
    if (options?.json) {
      console.log(JSON.stringify(deployments, null, 2));
      return;
    } else {
      deployments.results
        .filter(d => d.deploymentConfig && d.deploymentId)
        .forEach(d => {
          const versionString = d.deploymentConfig?.versionNumber ? `@${d.deploymentConfig.versionNumber}` : '@HEAD';
          const description = d.deploymentConfig?.description ? `- ${d.deploymentConfig.description}` : '';
          console.log(`- ${d.deploymentId} ${versionString} ${description}`);
        });
    }
  });
