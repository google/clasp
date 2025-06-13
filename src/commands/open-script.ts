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

// This file defines the 'open-script' command for the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {openUrl} from './utils.js';

export const command = new Command('open-script')
  .arguments('[scriptId]')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command, scriptId: string | undefined): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    if (!scriptId) {
      scriptId = clasp.project.scriptId;
    }
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to open IDE.',
      });
      this.error(msg);
    }

    const url = new URL(`https://script.google.com/d/${scriptId}/edit`);
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
