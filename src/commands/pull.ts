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
import path from 'path';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {isInside, ProjectFile} from '../core/files.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly versionNumber?: number;
  readonly deleteUnusedFiles?: boolean;
  readonly force?: boolean;
}

export const command = new Command('pull')
  .description('Fetch a remote project')
  .option('--versionNumber <version>', 'The version number of the project to retrieve.')
  .option('-d, --deleteUnusedFiles ', 'Delete local files that are not in the remote project. Use with caution.')
  .option('-f, --force', 'Forcibly delete local files that are not in the remote project without prompting.')
  .action(async function (this: Command): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const versionNumber = options.versionNumber;
    const forceDelete = options.force;

    // First, collect a list of current local files before pulling.
    // This is used to determine which files might need to be deleted if --deleteUnusedFiles is active.
    let spinnerMsg = intl.formatMessage({
      defaultMessage: 'Checking local files...',
    });
    const {files: localFiles, skipped: skippedLocal} = await clasp.files.collectLocalFiles();

    if (!options.json && skippedLocal.length > 0) {
      skippedLocal.forEach(item => {
        if (item.reason === 'symlink') {
          console.warn(
            intl.formatMessage(
              {
                defaultMessage: 'Security Warning: Skipping symbolic link {file}. Symbolic links are not supported.',
              },
              {file: item.localPath},
            ),
          );
        }
      });
    }

    // Perform the pull operation from the remote Apps Script project.
    // This fetches the files (optionally a specific version) and writes them to the local filesystem.
    spinnerMsg = intl.formatMessage({
      defaultMessage: 'Pulling files...',
    });
    const {files, writeResult} = await withSpinner(spinnerMsg, async () => {
      return clasp.files.pull(versionNumber); // `clasp.files.pull` handles fetching and writing.
    });

    if (!options.json && writeResult.skipped.length > 0) {
      writeResult.skipped.forEach(item => {
        console.warn(
          intl.formatMessage(
            {
              defaultMessage: 'Security Warning: Skipping write of {file} ({reason}).',
            },
            {
              file: item.localPath,
              reason: item.reason === 'parent_symlink'
                ? 'parent directory contains a symbolic link'
                : item.reason === 'target_symlink'
                ? 'target path is a symbolic link'
                : 'outside project directory or unsafe race condition detected',
            },
          ),
        );
      });
    }

    const pulledFiles = files.map(f => f.localPath);
    let deletedFiles: string[] = [];

    // If the --deleteUnusedFiles option is used, identify and delete local files
    // that are no longer present in the remote project.
    if (options.deleteUnusedFiles) {
      // Compare the initial list of local files with the files just pulled.
      // Any file in `localFiles` that is not in `files` (the pulled files) is considered unused.
      const filesToDelete = localFiles.filter(f => !files.find(p => p.localPath === f.localPath));
      deletedFiles = await deleteLocalFiles(clasp, filesToDelete, forceDelete, options.json);
    }

    if (options.json) {
      console.log(JSON.stringify({pulledFiles, deletedFiles}, null, 2));
      return;
    }

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
  });

async function deleteLocalFiles(
  clasp: Clasp,
  filesToDelete: ProjectFile[],
  forceDelete = false,
  json = false,
) {
  if (!filesToDelete || filesToDelete.length === 0) {
    return []; // No files to delete.
  }
  const skipConfirmation = forceDelete;

  // If not in an interactive terminal and --force is not used, skip deletion with a warning.
  // This prevents accidental deletion in non-interactive environments like CI scripts.
  if (!isInteractive() && !forceDelete) {
    if (!json) {
      const msg = intl.formatMessage({
        defaultMessage: 'You are not in an interactive terminal and --force not used. Skipping file deletion.',
      });
      console.warn(msg);
    }

    return [];
  }

  const absoluteContentDir = path.resolve(clasp.files.contentDir);
  const realContentDir = await fs.realpath(absoluteContentDir).catch(() => absoluteContentDir);
  const allowSymlinks = clasp.files.allowSymlinks;
  if (!allowSymlinks && realContentDir !== absoluteContentDir) {
    throw new Error(`Security Error: Content directory is a symlink. Possible race attack.`);
  }

  const deletedFiles: string[] = [];
  for (const file of filesToDelete) {
    const targetPath = path.resolve(absoluteContentDir, file.localPath);
    if (!(await isSafeToDelete(targetPath, realContentDir, allowSymlinks))) {
      throw new Error(`Security Error: Attempted to delete unsafe file: ${file.localPath}`);
    }

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
      await fs.unlink(targetPath); // Delete the file from the local system safely using resolved path.
      deletedFiles.push(file.localPath);
      if (!json) {
        console.log(intl.formatMessage({defaultMessage: 'Deleted {file}'}, {file: file.localPath}));
      }
    }
  }

  return deletedFiles;
}

async function isSafeToDelete(targetPath: string, realContentDir: string, allowSymlinks = false): Promise<boolean> {
  if (!isInside(realContentDir, targetPath)) {
    return false;
  }

  if (!allowSymlinks) {
    const parentDir = path.dirname(targetPath);
    if (parentDir !== realContentDir) {
      let current = parentDir;
      while (current !== realContentDir && current.length > realContentDir.length) {
        try {
          const realCurrent = await fs.realpath(current);
          if (realCurrent !== current) {
            return false;
          }
        } catch {
          // Directory doesn't exist
        }
        current = path.dirname(current);
      }
    }
  }

  try {
    const stat = await fs.lstat(targetPath);
    if (!allowSymlinks && stat.isSymbolicLink()) {
      return false;
    }
  } catch {
    return false; // File doesn't exist
  }

  return true;
}

