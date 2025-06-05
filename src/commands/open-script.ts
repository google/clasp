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
 * @fileoverview Implements the `clasp open-script` command, which opens the
 * Apps Script project in the script editor (script.google.com) in the user's
 * default web browser. It can open the current project or a specified script ID.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {openUrl} from './utils.js';

/**
 * Command to open an Apps Script project in the script editor.
 * If a script ID is provided, it opens that specific project. Otherwise, it attempts
 * to open the project defined in the current directory's .clasp.json file.
 */
export const command = new Command('open-script')
  .arguments('[scriptId]')
  .description('Open the Apps Script editor for the current project or a specified script ID.')
  /**
   * Action handler for the `open-script` command.
   * @param scriptIdOptional Optional script ID to open. If not provided, uses the current project's script ID.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, scriptIdOptional?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    let scriptIdToOpen: string | undefined = scriptIdOptional;

    // If no scriptId is provided as an argument, use the scriptId from the current project's settings.
    if (!scriptIdToOpen) {
      scriptIdToOpen = clasp.project.scriptId;
    }

    // If still no scriptId is found (neither as argument nor in project settings), error out.
    if (!scriptIdToOpen) {
      const msg = intl.formatMessage({
        defaultMessage: 'No script ID provided and no project found in the current directory. Please specify a script ID or run this command in a clasp project.',
      });
      this.error(msg);
    }

    // Construct the URL to the Apps Script editor.
    const editorUrl = new URL(`https://script.google.com/d/${scriptIdToOpen}/edit`);

    // Optionally include user hint for account selection in the browser.
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      if (userHint) {
        editorUrl.searchParams.set('authUser', userHint);
      }
    }

    // Open the constructed URL in the default browser.
    await openUrl(editorUrl.toString());
  });
