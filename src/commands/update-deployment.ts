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

// This file defines the 'update-deployment' (alias 'redeploy') command for
// the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly versionNumber?: number;
  readonly description?: string;
  readonly deploymentId?: string;
}

export const command = new Command('update-deployment')
  .alias('redeploy')
  .argument('<deploymentId>')
  .description('Updates a deployment for a project to a new version')
  .option('-V, --versionNumber <version>', 'The project version')
  .option('-d, --description <description>', 'The deployment description')
  .option('--json', 'Show output in JSON format')
  .action(async function (this: Command, deploymentId: string): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const description = options.description ?? '';
    const versionNumber = options.versionNumber ? Number(options.versionNumber) : undefined;

    if (!deploymentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Deployment ID is required to redeploy.',
      });
      this.error(msg);
    }
    try {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Deploying project...',
      });
      const deployment = await withSpinner(spinnerMsg, async () => {
        return clasp.project.deploy(description, deploymentId, versionNumber);
      });

      if (options.json) {
        const output = {
          deploymentId: deployment.deploymentId,
          versionNumber: deployment.deploymentConfig?.versionNumber,
          description: deployment.deploymentConfig?.description,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Redeployed {deploymentId} {version, select, 
          undefined {@HEAD}
          other {@{version}}
        }`,
        },
        {
          deploymentId: deployment.deploymentId,
          version: deployment.deploymentConfig?.versionNumber,
        },
      );
      console.log(successMessage);
    } catch (error) {
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        this.error(error.cause.message);
      }
      throw error;
    }
  });
