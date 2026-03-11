// Copyright 2019 Google LLC
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

// This file defines the 'push' command for the clasp CLI.

import path from 'path';
import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly watch?: boolean;
  readonly force?: boolean;
}

export const command = new Command('push')
  .description('Update the remote project')
  .option('-f, --force', 'Forcibly overwrites the remote manifest.')
  .option('-w, --watch', 'Watches for local file changes. Pushes when a non-ignored file changes.')
  .action(async function (this: Command) {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const watch = options.watch;
    let force = options.force; // Store the force option, as it can be updated by confirmManifestUpdate

    // Defines the action to take when a file change is detected (either initially or during watch mode).
    const onChange = async (paths: string[]) => {
      // Check if the manifest file (appsscript.json) is among the changed files.
      const isManifestUpdated = paths.findIndex(p => path.basename(p) === 'appsscript.json') !== -1;
      // If the manifest is updated and not using --force, prompt the user for confirmation.
      if (isManifestUpdated && !force) {
        force = await confirmManifestUpdate(); // Update force based on user's choice.
        if (!force) {
          // If user declines manifest overwrite, skip the push.
          if (!options.json) {
            const msg = intl.formatMessage({
              defaultMessage: 'Skipping push.',
            });
            console.log(msg);
          }

          return; // Exit onChange without pushing.
        }
      }

      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Pushing files...',
      });
      // Perform the push operation using the core `clasp.files.push()` method.
      const files = await withSpinner(spinnerMsg, async () => {
        return clasp.files.push();
      });
      //Generate localised timestamp for the output
      const timestamp = new Date().toLocaleTimeString();
      if (options.json) {
        console.log(
          JSON.stringify(
            files.map(f => f.localPath),
            null,
            2,
          ),
        );
        return;
      }

      // Log the result of the push.
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Pushed {count, plural, 
        =0 {no files}
        one {one file}
        other {# files}} at {time}.`,
        },
        {
          count: files.length,
          time: timestamp,
        },
      );
      console.log(successMessage);
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      return true; // Indicate that the push was attempted (or successfully skipped by user).
    };

    // Initial check for pending changes when the command is first run.
    const pendingChanges = await clasp.files.getChangedFiles();
    if (pendingChanges.length) {
      // If there are changes, map them to their paths and call onChange.
      const paths = pendingChanges.map(f => f.localPath);
      await onChange(paths);
    } else {
      if (options.json) {
        console.log(JSON.stringify([], null, 2));
        return;
      }
      // If no changes, inform the user.
      const msg = intl.formatMessage({
        defaultMessage: 'Script is already up to date.',
      });
      console.log(msg);
    }

    // If not in watch mode, exit after the initial push attempt.
    if (!watch) {
      return;
    }

    // Setup for watch mode.
    const onReady = async () => {
      const msg = intl.formatMessage({
        defaultMessage: 'Waiting for changes...',
      });
      console.log(msg);
    };

    // Start watching local files. The `onChange` function will be called on subsequent changes.
    // `watchLocalFiles` returns a function to stop the watcher.
    const stopWatching = await clasp.files.watchLocalFiles(onReady, async paths => {
      // If onChange returns undefined (e.g. user skipped manifest push), it implies we should stop watching.
      // This can happen if the user cancels the manifest push in interactive mode.
      if (!(await onChange(paths))) {
        stopWatching();
      }
    });
  });

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
async function confirmManifestUpdate(): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const prompt = intl.formatMessage({
    defaultMessage: 'Manifest file has been updated. Do you want to push and overwrite?',
  });
  const answer = await inquirer.prompt([
    {
      default: false,
      message: prompt,
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
  return answer.overwrite;
}
