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
 * @fileoverview Implements the `clasp show-authorized-user` command.
 * This command displays information about the currently authenticated Google user,
 * specifically their email address, or indicates if the user is not logged in.
 */

import {Command} from 'commander';
import {AuthInfo, getUserInfo} from '../auth/auth.js';
import {intl} from '../intl.js';

/**
 * Command to display information about the currently authorized Google user.
 * Shows the user's email if logged in, or a message indicating no user is logged in.
 */
export const command = new Command('show-authorized-user')
  .description('Show information about the current authorized Google user for clasp.')
  /**
   * Action handler for the `show-authorized-user` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth; // AuthInfo is pre-initialized by program.ts hook

    // Check if there are active credentials.
    if (!auth.credentials) {
      const notLoggedInMsg = intl.formatMessage({
        defaultMessage: 'You are not currently logged in to clasp.',
      });
      console.log(notLoggedInMsg);
      return;
    }

    // Fetch and display user information if credentials exist.
    const user = await getUserInfo(auth.credentials);
    const displayMsg = intl.formatMessage(
      {
        defaultMessage: `{email, select,
          undefined {Logged in, but could not retrieve user email.}
          other {Currently logged in as: {email}}
        }`,
      },
      {
        email: user?.email, // user.email might be undefined if getUserInfo fails or returns no email
      },
    );
    console.log(displayMsg);
  });
