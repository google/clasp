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

import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

export const command = new Command('clone-script')
  .alias('clone')
  .description('Clone an existing script')
  .arguments('[scriptId] [versionNumber]')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  .action(async function (this: Command, scriptId: string, versionNumber: number | undefined) {
    let clasp: Clasp = this.opts().clasp;

    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'Project file already exists.',
      });
      this.error(msg);
    }

    const rootDir: string = this.opts().rootDir;

    clasp.withContentDir(rootDir ?? '.');

    if (scriptId) {
      const match = scriptId.match(/https:\/\/script\.google\.com\/d\/([^/]+)\/.*/);
      if (match) {
        scriptId = match[1];
      } else {
        scriptId = scriptId.trim();
      }
    } else if (isInteractive()) {
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
      const files = await withSpinner(cloningScriptMsg, async () => {
        clasp = clasp.withScriptId(scriptId);
        const files = await clasp.files.pull(versionNumber);
        clasp.project.updateSettings();
        return files;
      });
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
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid script ID.',
        });
        this.error(msg);
      }
      throw error;
    }
  });
