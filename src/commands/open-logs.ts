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

// This file defines the 'open-logs' command for the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-logs')
  .description('Open logs in the developer console')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const url = new URL('https://console.cloud.google.com/logs/viewer');
    url.searchParams.set('project', projectId ?? '');
    url.searchParams.set('resource', 'app_script_function');
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    await openUrl(url.toString());
  });
