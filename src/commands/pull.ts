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

    let spinnerMsg = intl.formatMessage({
      defaultMessage: 'Checking local files...',
    });
    const localFiles = await clasp.files.collectLocalFiles();
    spinnerMsg = intl.formatMessage({
      defaultMessage: 'Pulling files...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      return await clasp.files.pull(versionNumber);
    });

    if (options.deleteUnusedFiles) {
      const filesToDelete = localFiles.filter(f => !files.find(p => p.localPath === f.localPath));
      await deleteLocalFiles(filesToDelete, forceDelete);
    }

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
  });

async function deleteLocalFiles(filesToDelete: ProjectFile[], forceDelete = false) {
  if (!filesToDelete || filesToDelete.length === 0) {
    return;
  }
  const skipConfirmation = forceDelete;

  if (!isInteractive() && !forceDelete) {
    const msg = intl.formatMessage({
      defaultMessage: 'You are not in an interactive terminal and --force not used. Skipping file deletion.',
    });
    console.warn(msg);
    return;
  }

  for (const file of filesToDelete) {
    if (!skipConfirmation) {
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
      if (!confirm.deleteFile) {
        continue;
      }
    }

    await fs.unlink(file.localPath);
    console.log(intl.formatMessage({defaultMessage: 'Deleted {file}'}, {file: file.localPath}));
  }
}
