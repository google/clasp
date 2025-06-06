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

// This file defines the 'disable-api' command for the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('disable-api')
  .description('Disable a service for the current project.')
  .argument('<api>', 'Service to disable')
  .action(async function (this: Command, serviceName: string) {
    const clasp: Clasp = this.opts().clasp;
    await maybePromptForProjectId(clasp);

    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Disabling service...',
    });
    await withSpinner(spinnerMsg, async () => {
      await clasp.services.disableService(serviceName);
    });

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Disabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
