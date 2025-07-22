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

// This file defines the 'enable-api' command for the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {}

export const command = new Command('enable-api')
  .description('Enable a service for the current project.')
  .argument('<api>', 'Service to enable')
  .action(async function (this: Command, serviceName: string) {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    try {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Enabling service...',
      });
      await withSpinner(spinnerMsg, async () => {
        await clasp.services.enableService(serviceName);
      });
    } catch (error) {
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        const msg = intl.formatMessage(
          {
            defaultMessage: 'Not authorized to enable {name} or it does not exist.',
          },
          {
            name: serviceName,
          },
        );
        this.error(msg);
      }
      throw error;
    }

    if (options.json) {
      console.log(JSON.stringify({success: true}, null, 2));
      return;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Enabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
