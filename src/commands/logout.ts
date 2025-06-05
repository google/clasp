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
 * @fileoverview Implements the `clasp logout` command, which allows users
 * to log out by deleting their locally stored credentials.
 */

import {Command} from 'commander';
import {AuthInfo} from '../auth/auth.js';
import {intl} from '../intl.js';

/**
 * Command to log the user out by deleting their stored OAuth credentials.
 */
export const command = new Command('logout')
  .description('Log out of clasp by deleting local credentials.')
  /**
   * Action handler for the `logout` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth; // AuthInfo is pre-initialized

    // Check if a credential store is available.
    if (!auth.credentialStore) {
      const msg = intl.formatMessage({
        defaultMessage: 'No credential store found. Unable to determine login status or log out.',
      });
      this.error(msg); // Exits the command.
    }

    // Check if the user is actually logged in.
    if (!auth.credentials) {
      console.log(intl.formatMessage({defaultMessage: 'You are not logged in.'}));
      return; // Nothing to do if not logged in.
    }

    // Attempt to delete the credentials for the current user.
    try {
      await auth.credentialStore.delete(auth.user);
      const successMessage = intl.formatMessage({
        defaultMessage: 'Successfully logged out. Credentials for user "{user}" have been deleted.',
      }, {user: auth.user});
      console.log(successMessage);
    } catch (error) {
      // Handle potential errors during credential deletion.
      const errorMsg = intl.formatMessage({
        defaultMessage: 'An error occurred while trying to delete credentials: {errorMessage}',
      }, {errorMessage: error.message});
      this.error(errorMsg);
    }
  });
