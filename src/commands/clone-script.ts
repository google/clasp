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
 * @fileoverview Implements the `clasp clone` command, which allows users to
 * clone an existing Apps Script project into the local filesystem.
 * It supports cloning by script ID or by prompting the user to select from a list
 * of their projects. It also allows specifying a version number and a root directory
 * for the cloned project.
 */

import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

/**
 * Command to clone an existing Apps Script project.
 * Fetches the project by its script ID (or prompts the user to select one)
 * and saves its files to the local filesystem.
 */
export const command = new Command('clone-script')
  .alias('clone')
  .description('Clone an existing script')
  .arguments('[scriptId] [versionNumber]')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  /**
   * Action handler for the `clone` command.
   * @param scriptId The ID or URL of the script to clone. Optional.
   * @param versionNumber The version number of the script to clone. Optional.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, scriptId: string, versionNumber: number | undefined) {
    let clasp: Clasp = this.opts().clasp;

    // Prevent cloning into an existing clasp project.
    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'Project file already exists.',
      });
      this.error(msg);
    }

    const rootDir: string = this.opts().rootDir;

    clasp.withContentDir(rootDir ?? '.'); // Set content directory, defaults to current directory.

    if (scriptId) {
      // If scriptId is a URL, extract the ID from it.
      const match = scriptId.match(/https:\/\/script\.google\.com\/d\/([^/]+)\/.*/);
      if (match) {
        scriptId = match[1]; // Extracted script ID from URL.
      } else {
        scriptId = scriptId.trim(); // Assume it's a raw ID, just trim whitespace.
      }
    } else if (isInteractive()) {
      // If no scriptId is provided and in interactive mode, prompt the user to select a script.
      const projects = await clasp.project.listScripts();
      if (!projects.results.length) {
        const msg = intl.formatMessage({defaultMessage: 'No script projects found to clone.'});
        this.error(msg);
        return; // Early exit if no projects are available.
      }
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
      const files = await withSpinner(cloningScriptMsg, async () => {
        clasp = clasp.withScriptId(scriptId); // Associate the clasp instance with the chosen script ID.
        const pulledFiles = await clasp.files.pull(versionNumber); // Pull the script files.
        await clasp.project.updateSettings(); // Save the project settings (.clasp.json).
        return pulledFiles;
      });
      files.forEach(f => console.log(`└─ ${f.localPath}`)); // Display pulled files.
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
      // Handle common error cases specifically.
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid script ID provided. Please check the ID and try again.',
        });
        this.error(msg);
      }
      // Rethrow other errors to be handled by the global error handler.
      throw error;
    }
  });
