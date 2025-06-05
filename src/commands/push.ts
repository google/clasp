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
 * @fileoverview Implements the `clasp push` command, which uploads local
 * project files to the Apps Script server. It can also optionally watch for
 * local file changes and automatically push them.
 */

import path from 'path';
import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `push` command.
 */
interface CommandOption {
  /** If true, watches for local file changes and pushes them automatically. */
  readonly watch?: boolean;
  /** If true, forcibly overwrites the remote manifest if local changes are detected. */
  readonly force?: boolean;
}

/**
 * Command to upload local project files to the Apps Script server.
 * Can optionally watch for changes and push automatically.
 */
export const command = new Command('push')
  .description('Update the remote Apps Script project with local changes.')
  .option('-f, --force', 'Forcibly overwrite the remote manifest if local changes are detected. Use with caution.')
  .option('-w, --watch', 'Watch for local file changes and automatically push them.')
  /**
   * Action handler for the `push` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const {watch, force: initialForce} = options;
    let forcePush = initialForce; // Allow forcePush to be updated by manifest confirmation.

    /**
     * Handles the push operation, including manifest update confirmation.
     * This function is called for the initial push and for subsequent pushes in watch mode.
     * @param changedPaths Array of paths that triggered the push (primarily for manifest check).
     * @returns True if the push was successful or skipped by user, false if watch should stop.
     */
    const performPush = async (changedPaths: string[]): Promise<boolean> => {
      // Check if the manifest file (appsscript.json) is among the changed paths.
      const isManifestChanged = changedPaths.some(p => path.basename(p) === 'appsscript.json');

      if (isManifestChanged && !forcePush) {
        // If manifest changed and not forcing, prompt user for confirmation.
        const confirmed = await confirmManifestUpdate();
        if (!confirmed) {
          console.log(intl.formatMessage({defaultMessage: 'Push canceled by user due to manifest change.'}));
          return true; // User chose not to push, but watch can continue.
        }
        // User confirmed, so subsequent operations in this push can be considered forced.
        // Note: this `forcePush = true` only applies to this specific `performPush` call,
        // it doesn't change the `initialForce` for subsequent independent file changes in watch mode.
        // If a non-manifest file changes later, and then manifest changes again, user will be prompted again unless --force was global.
      }

      const pushingMsg = intl.formatMessage({
        defaultMessage: 'Pushing files...',
      });
      const pushedFiles = await withSpinner(pushingMsg, async () => {
        return clasp.files.push(); // Core push operation.
      });

      const successMessage = intl.formatMessage(
        {
        {
          defaultMessage: `Pushed {count, plural,
            =0 {no files}
            one {1 file}
            other {# files}
          }.`,
        },
        {count: pushedFiles.length},
      );
      console.log(successMessage);
      pushedFiles.forEach(file => console.log(`└─ ${file.localPath}`));
      return true; // Push successful.
    };

    // Perform an initial push if there are pending changes.
    const initialChanges = await clasp.files.getChangedFiles();
    if (initialChanges.length > 0) {
      const paths = initialChanges.map(f => f.localPath);
      await performPush(paths);
    } else {
      console.log(intl.formatMessage({defaultMessage: 'No local changes to push.'}));
    }

    // If not in watch mode, exit after the initial push.
    if (!watch) {
      return;
    }

    // Setup watch mode.
    const onReady = () => {
      console.log(intl.formatMessage({defaultMessage: 'Watching for file changes... Press Ctrl+C to exit.'}));
    };

    const stopWatching = await clasp.files.watchLocalFiles(onReady, async changedPaths => {
      console.log(intl.formatMessage({defaultMessage: '\nDetected file changes:'}));
      changedPaths.forEach(p => console.log(`  - ${p}`));
      if (!(await performPush(changedPaths))) {
        // performPush returning false would indicate a critical error, stop watching.
        stopWatching();
      }
    });
  });

/**
 * Prompts the user to confirm overwriting the remote manifest file if local changes are detected.
 * Only prompts if running in an interactive terminal.
 * @returns {Promise<boolean>} True if the user confirms or if not interactive, false otherwise.
 */
async function confirmManifestUpdate(): Promise<boolean> {
  // If not in an interactive terminal, default to not overwriting (safety measure).
  if (!isInteractive()) {
    console.warn(intl.formatMessage({defaultMessage: 'Manifest file has changed. Run with --force to overwrite in non-interactive mode.'}));
    return false;
  }

  const promptMessage = intl.formatMessage({
    defaultMessage: 'The manifest file (appsscript.json) has been updated locally. Pushing these changes will overwrite the remote manifest. Do you want to proceed?',
  });
  const answers = await inquirer.prompt([
    {
      default: false,
      message: prompt,
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
  return answer.overwrite;
}
