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

// This file defines the 'clone-script' command for the clasp CLI.

import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly rootDir?: string;
}

export const command = new Command('clone-script')
  .alias('clone')
  .description('Clone an existing script')
  .arguments('[scriptId] [versionNumber]')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  .action(async function (this: Command, scriptId: string, versionNumber: number | undefined) {
    const options: CommandOptions = this.optsWithGlobals();
    let clasp: Clasp = options.clasp;

    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'Project file already exists.',
      });
      this.error(msg);
    }

    const rootDir = options.rootDir;

    clasp.withContentDir(rootDir ?? '.');

    // Determine the script ID to clone.
    // Priority: 1. Directly provided scriptId argument. 2. Extracted from a URL. 3. Selected from a list in interactive mode.
    if (scriptId) {
      // If a scriptId is provided, check if it's a full URL and extract the ID.
      const match = scriptId.match(/https:\/\/script\.google\.com\/d\/([^/]+)\/.*/);
      if (match) {
        scriptId = match[1]; // Use the extracted ID from the URL.
      } else {
        scriptId = scriptId.trim(); // Otherwise, use the provided ID as is (after trimming).
      }
    } else if (isInteractive()) {
      // If no scriptId is provided and the session is interactive, prompt the user to choose.
      const projects = await clasp.project.listScripts();
      const choices = projects.results.map(file => ({
        name: `${file.name.padEnd(20)} - https://script.google.com/d/${file.id}/edit`,
        value: file.id,
      }));
      const prompt = intl.formatMessage({defaultMessage: 'Clone which script?'});
      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: prompt,
          name: 'scriptId',
          pageSize: 30,
          type: 'list',
        },
      ]);
      scriptId = answer.scriptId;
    }

    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'No script ID.',
      });
      this.error(msg);
    }

    try {
      const cloningScriptMsg = intl.formatMessage({
        defaultMessage: 'Cloning script...',
      });
      // Perform the cloning operation:
      // 1. Configure the clasp instance with the determined script ID.
      // 2. Pull the files from the remote project (optionally a specific version).
      // 3. Update the local .clasp.json project settings file.
      const files = await withSpinner(cloningScriptMsg, async () => {
        clasp = clasp.withScriptId(scriptId);
        const files = await clasp.files.pull(versionNumber);
        // After successfully pulling files, update the local project settings (e.g., .clasp.json)
        // to reflect the cloned scriptId and other relevant configurations.
        clasp.project.updateSettings();
        return files;
      });

      if (options.json) {
        console.log(JSON.stringify({scriptId, files: files.map(f => f.localPath)}, null, 2));
        return;
      }

      // Log the paths of the cloned files.
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Cloned {count, plural, 
          =0 {no files.}
          one {one file.}
          other {# files}}.`,
        },
        {
          count: files.length,
        },
      );
      console.log(successMessage);
    } catch (error) {
      // Handle specific error codes from the API, like an invalid script ID.
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid script ID.',
        });
        this.error(msg); // Output a user-friendly error and exit.
      }
      // For other errors, rethrow to be caught by the global error handler.
      throw error;
    }
  });
