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

// This file defines the 'logout' command for the clasp CLI.

import {Command} from 'commander';
import {AuthInfo} from '../auth/auth.js';
import {intl} from '../intl.js';
import {GlobalOptions} from './utils.js';

interface CommandOptions extends GlobalOptions {}

export const command = new Command('logout').description('Logout of clasp').action(async function (
  this: Command,
): Promise<void> {
  const options: CommandOptions = this.optsWithGlobals();
  const auth: AuthInfo = options.authInfo;

  if (!auth.credentialStore) {
    const msg = intl.formatMessage({
      defaultMessage: 'No credential store found, unable to log out.',
    });
    this.error(msg);
  }

  if (!auth.credentials) {
    if (options.json) {
      console.log(JSON.stringify({success: true}, null, 2));
    }
    return;
  }

  auth.credentialStore?.delete(auth.user);

  if (options.json) {
    console.log(JSON.stringify({success: true}, null, 2));
    return;
  }

  const successMessage = intl.formatMessage({
    defaultMessage: 'Deleted credentials.',
  });
  console.log(successMessage);
});
