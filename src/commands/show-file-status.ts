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

// This file defines the 'show-file-status' (alias 'status') command for the
// clasp CLI.

import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly json?: boolean;
}

export const command = new Command('show-file-status')
  .alias('status')
  .description('Lists files that will be pushed by clasp')
  .action(async function (this: Command): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = this.opts().clasp;

    const outputAsJson = options?.json ?? false;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Analyzing project files...',
    });
    const [filesToPush, untrackedFiles] = await withSpinner(spinnerMsg, async () => {
      return await Promise.all([clasp.files.collectLocalFiles(), clasp.files.getUntrackedFiles()]);
    });

    if (outputAsJson) {
      const json = JSON.stringify({
        filesToPush: filesToPush.map(f => f.localPath),
        untrackedFiles,
      });
      console.log(json);
      return;
    }

    const trackedMsg = intl.formatMessage({
      defaultMessage: 'Tracked files:',
    });
    console.log(trackedMsg);
    for (const file of filesToPush) {
      console.log(`└─ ${file.localPath}`);
    }
    const untrackedMsg = intl.formatMessage({
      defaultMessage: 'Untracked files:',
    });
    console.log(untrackedMsg);
    for (const file of untrackedFiles) {
      console.log(`└─ ${file}`);
    }
  });
