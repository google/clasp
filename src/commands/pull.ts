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
 * @fileoverview Implements the `clasp pull` command, which fetches the latest
 * version of an Apps Script project from Google Drive and updates the local
 * file system. It can also optionally delete local files that are not present
 * in the remote project.
 */

import {Command} from 'commander';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {ProjectFile} from '../core/files.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `pull` command.
 */
interface CommandOption {
  /** The version number of the project to retrieve. */
  readonly versionNumber?: number;
  /** If true, delete local files that are not in the remote project. */
  readonly deleteUnusedFiles?: boolean;
  /** If true, forcibly delete local files without prompting when `deleteUnusedFiles` is also true. */
  readonly force?: boolean;
}

/**
 * Command to fetch the latest version of an Apps Script project from Google Drive
 * and update the local file system.
 */
export const command = new Command('pull')
  .description('Fetch the latest code from the remote Apps Script project.')
  .option('--versionNumber <version>', 'The version number of the project to retrieve. If not specified, pulls the latest code.')
  .option('--deleteUnusedFiles', 'Delete local files that are not present in the remote project. Use with caution.')
  .option('--force', 'Forcibly delete local files (when used with --deleteUnusedFiles) without prompting.')
  /**
   * Action handler for the `pull` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const {versionNumber, force: forceDelete, deleteUnusedFiles: optionDeleteUnusedFiles} = options;

    // Collect local files before pulling to compare later for deletion.
    const checkingMsg = intl.formatMessage({defaultMessage: 'Checking local project files...'});
    const localFiles = await withSpinner(checkingMsg, async () => clasp.files.collectLocalFiles());

    // Pull files from the remote project.
    const pullingMsg = intl.formatMessage({defaultMessage: 'Pulling files from Apps Script project...'});
    const pulledFiles = await withSpinner(pullingMsg, async () => {
      return clasp.files.pull(versionNumber); // `pull` handles writing files to disk.
    });

    // If deleteUnusedFiles option is enabled, identify and delete local files not present in the pulled files.
    if (optionDeleteUnusedFiles) {
      const filesToDelete = localFiles.filter(
        localFile => !pulledFiles.find(pulledFile => pulledFile.localPath === localFile.localPath),
      );
      if (filesToDelete.length > 0) {
        console.log(intl.formatMessage({defaultMessage: 'Deleting local files not found in remote project:'}));
        await deleteLocalFiles(filesToDelete, forceDelete);
      } else {
        console.log(intl.formatMessage({defaultMessage: 'No local files to delete.'}));
      }
    }

    pulledFiles.forEach(f => console.log(`└─ ${f.localPath}`));
    const pulledCount = pulledFiles.length;
    const successMessage = intl.formatMessage(
      {
        defaultMessage: `Pulled {count, plural,
          =0 {no files}
          one {1 file}
          other {# files}
        } from Apps Script.`,
      },
      {count: pulledCount},
    );
    console.log(successMessage);
  });

/**
 * Deletes a list of local project files.
 * It can operate interactively, prompting the user for each deletion,
 * or forcibly delete files if `forceDelete` is true.
 * @param filesToDelete An array of `ProjectFile` objects to delete.
 * @param forceDelete If true, deletes files without user confirmation. Defaults to false.
 */
async function deleteLocalFiles(filesToDelete: ProjectFile[], forceDelete = false): Promise<void> {
  if (!filesToDelete || filesToDelete.length === 0) {
    return; // No files to delete.
  }

  // In non-interactive mode, files are only deleted if --force is used.
  if (!isInteractive() && !forceDelete) {
    const msg = intl.formatMessage({
      defaultMessage: 'Running in non-interactive mode and --force not used. Skipping deletion of local files not found in remote project.',
    });
    console.warn(msg);
    filesToDelete.forEach(file => console.warn(intl.formatMessage({defaultMessage: '  Skipped deletion: {file}'}, {file: file.localPath})));
    return;
  }

  for (const file of filesToDelete) {
    let deleteConfirmed = forceDelete; // If forceDelete is true, skip confirmation.

    if (!deleteConfirmed) {
      // Prompt for confirmation if not forcing.
      const answers = await inquirer.prompt<{confirmDelete: boolean}>([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: intl.formatMessage(
            {defaultMessage: 'Delete local file "{file}" not found in remote project?'},
            {file: file.localPath},
          ),
          default: false,
        },
      ]);
      deleteConfirmed = answers.confirmDelete;
    }

    if (deleteConfirmed) {
      try {
        await fs.unlink(file.localPath);
        console.log(intl.formatMessage({defaultMessage: '  Deleted: {file}'}, {file: file.localPath}));
      } catch (error) {
        console.error(intl.formatMessage({defaultMessage: '  Error deleting file {file}: {errorMessage}'}, {file: file.localPath, errorMessage: error.message}));
      }
    } else {
      console.log(intl.formatMessage({defaultMessage: '  Skipped deletion: {file}'}, {file: file.localPath}));
    }
  }
}
