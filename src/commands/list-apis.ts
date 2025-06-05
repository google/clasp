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

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('list-apis')
  .alias('apis')
  .description('List enabled APIs for the current project')
  .action(async function (this: Command) {
    const clasp: Clasp = this.opts().clasp;

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching APIs...',
    });
    const [enabledApis, availableApis] = await withSpinner(spinnerMsg, () =>
      Promise.all([clasp.services.getEnabledServices(), clasp.services.getAvailableServices()]),
    );

    const enabledApisLabel = intl.formatMessage({
      defaultMessage: '# Currently enabled APIs:',
    });
    console.log(`\n${enabledApisLabel}`);
    for (const service of enabledApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }

    const availableApisLabel = intl.formatMessage({
      defaultMessage: '# List of available APIs:',
    });
    console.log(`\n${availableApisLabel}`);
    for (const service of availableApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }
  });
