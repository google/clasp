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
 * @fileoverview Implements the `clasp open-container` command, which opens the
 * Google Drive container document (e.g., a Google Sheet, Doc, or Slide) to which
 * the current Apps Script project is bound.
 */

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {openUrl} from './utils.js';

/**
 * Command to open the Google Drive container document (e.g., Sheet, Doc)
 * associated with the current Apps Script project.
 */
export const command = new Command('open-container')
  .description('Open the Google Drive container document for the current Apps Script project.')
  /**
   * Action handler for the `open-container` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Retrieve the parentId (container document ID) from the project settings.
    const parentId = clasp.project.parentId;
    if (!parentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'This project is not bound to a container document, or the parent ID is not set in .clasp.json.',
      });
      this.error(msg); // Error out if no parentId is found.
    }

    // Construct the URL to open the Google Drive document.
    const containerUrl = new URL('https://drive.google.com/open');
    containerUrl.searchParams.set('id', parentId); // parentId is validated above.

    // Optionally include user hint for account selection in the browser.
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      if (userHint) {
        containerUrl.searchParams.set('authUser', userHint);
      }
    }

    // Open the constructed URL in the default browser.
    await openUrl(containerUrl.toString());
  });
