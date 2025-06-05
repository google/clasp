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

/**
 * @fileoverview Implements the `clasp status` or `clasp show-file-status` command.
 * This command displays a list of local files that are tracked by clasp and will
 * be pushed to the Apps Script project, as well as a list of untracked files
 * that are ignored by clasp (e.g., due to .claspignore settings or default ignores).
 * It supports output in both human-readable and JSON formats.
 */

import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `show-file-status` command.
 */
interface CommandOption {
  /** If true, outputs the status in JSON format. */
  readonly json?: boolean;
}

/**
 * Command to display the status of local files in relation to the Apps Script project.
 * Lists tracked files (to be pushed) and untracked files (ignored).
 */
export const command = new Command('show-file-status')
  .alias('status')
  .description('List local files that are tracked by clasp and will be pushed, and untracked files.')
  .option('--json', 'Output the status in JSON format.', false)
  /**
   * Action handler for the `show-file-status` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options?: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const outputAsJson = options?.json ?? false;

    const analyzingMsg = intl.formatMessage({
      defaultMessage: 'Analyzing local project files...',
    });

    // Concurrently collect local files that clasp will push and files that are untracked/ignored.
    const [filesToPush, untrackedFiles] = await withSpinner(analyzingMsg, async () => {
      return Promise.all([clasp.files.collectLocalFiles(), clasp.files.getUntrackedFiles()]);
    });

    if (outputAsJson) {
      // Output in JSON format.
      const statusJson = JSON.stringify(
        {
          filesToPush: filesToPush.map(file => file.localPath),
          untrackedFiles,
        },
        null,
        2, // Indent for readability.
      );
      console.log(statusJson);
      return;
    }

    // Output in human-readable format.
    const trackedMsg = intl.formatMessage({
      defaultMessage: 'Files that will be pushed to Apps Script:',
    });
    console.log(trackedMsg);
    if (filesToPush.length > 0) {
      filesToPush.forEach(file => console.log(`  └─ ${file.localPath}`));
    } else {
      console.log(intl.formatMessage({defaultMessage: '  No files are currently tracked to be pushed.'}));
    }

    const untrackedMsg = intl.formatMessage({
      defaultMessage: '\nFiles that are ignored (not pushed):',
    });
    console.log(untrackedMsg);
    if (untrackedFiles.length > 0) {
      untrackedFiles.forEach(file => console.log(`  └─ ${file}`));
    } else {
      console.log(intl.formatMessage({defaultMessage: '  No files are currently ignored.'}));
    }
  });
