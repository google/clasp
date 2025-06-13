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

// This file defines the 'pull' command for the clasp CLI.

import {Command} from 'commander';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {ProjectFile} from '../core/files.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

interface CommandOption {
  readonly versionNumber?: number;
  readonly deleteUnusedFiles?: boolean;
  readonly force?: boolean;
}

export const command = new Command('pull')
  .description('Fetch a remote project')
  .option('--versionNumber <version>', 'The version number of the project to retrieve.')
  .option('-d, --deleteUnusedFiles ', 'Delete local files that are not in the remote project. Use with caution.')
  .option('-f, --force', 'Forcibly delete local files that are not in the remote project without prompting.')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const versionNumber = options.versionNumber;
    const forceDelete = options.force;

    // First, collect a list of current local files before pulling.
    // This is used to determine which files might need to be deleted if --deleteUnusedFiles is active.
    let spinnerMsg = intl.formatMessage({
      defaultMessage: 'Checking local files...',
    });
    const localFiles = await clasp.files.collectLocalFiles();

    // Perform the pull operation from the remote Apps Script project.
    // This fetches the files (optionally a specific version) and writes them to the local filesystem.
    spinnerMsg = intl.formatMessage({
      defaultMessage: 'Pulling files...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      return await clasp.files.pull(versionNumber); // `clasp.files.pull` handles fetching and writing.
    });

    let deletedFilesPaths: string[] = [];
    // If the --deleteUnusedFiles option is used, identify and delete local files
    // that are no longer present in the remote project.
    if (options.deleteUnusedFiles) {
      // Compare the initial list of local files with the files just pulled.
      // Any file in `localFiles` that is not in `files` (the pulled files) is considered unused.
      const filesToDelete = localFiles.filter(f => !files.find(p => p.localPath === f.localPath));
      deletedFilesPaths = await deleteLocalFiles(filesToDelete, forceDelete, this.optsWithGlobals().json);
    }

    const outputAsJson = this.optsWithGlobals().json ?? false;
    if (outputAsJson) {
      const pulledFilesPaths = files.map(f => f.localPath);
      console.log(JSON.stringify({pulledFiles: pulledFilesPaths, deletedFiles: deletedFilesPaths}, null, 2));
    } else {
      // Log the paths of the pulled files.
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Pulled {count, plural,
        =0 {no files.}
        one {one file.}
        other {# files}}.`,
      },
      {
        count: files.length,
      },
    );
      console.log(successMessage);
    }
  });

async function deleteLocalFiles(
  filesToDelete: ProjectFile[],
  forceDelete = false,
  outputJson = false,
): Promise<string[]> {
  const deletedPaths: string[] = [];
  if (!filesToDelete || filesToDelete.length === 0) {
    return deletedPaths; // No files to delete.
  }
  const skipConfirmation = forceDelete;

  // If not in an interactive terminal and --force is not used, skip deletion with a warning.
  // This prevents accidental deletion in non-interactive environments like CI scripts.
  if (!isInteractive() && !forceDelete) {
    if (!outputJson) {
      const msg = intl.formatMessage({
        defaultMessage: 'You are not in an interactive terminal and --force not used. Skipping file deletion.',
      });
      console.warn(msg);
    }
    return deletedPaths;
  }

  for (const file of filesToDelete) {
    let doDelete = true; // Assume deletion unless confirmation is required and denied.
    if (!skipConfirmation) {
      // If not forcing, prompt the user to confirm deletion for each file.
      const confirm = await inquirer.prompt({
        type: 'confirm',
        name: 'deleteFile',
        message: intl.formatMessage(
          {
            defaultMessage: 'Delete {file}?',
          },
          {file: file.localPath},
        ),
      });
      doDelete = confirm.deleteFile;
    }

    if (doDelete) {
      await fs.unlink(file.localPath); // Delete the file from the local system.
      deletedPaths.push(file.localPath);
      if (!outputJson) {
        console.log(intl.formatMessage({defaultMessage: 'Deleted {file}'}, {file: file.localPath}));
      }
    }
  }
  return deletedPaths;
}
