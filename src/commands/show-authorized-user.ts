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

// This file defines the 'show-authorized-user' command for the clasp CLI.

import {Command} from 'commander';
import {AuthInfo, getUserInfo} from '../auth/auth.js';
import {intl} from '../intl.js';

export const command = new Command('show-authorized-user')
  .description('Show information about the current authorizations state.')
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth;

    if (!auth.credentials) {
      const msg = intl.formatMessage({
        defaultMessage: 'Not logged in.',
      });
      console.log(msg);
      return;
    }

    const user = await getUserInfo(auth.credentials);
    const msg = intl.formatMessage(
      {
        defaultMessage: `{email, select,
        undefined {You are logged in as an unknown user.}
        other {You are logged in as {email}.}}`,
      },
      {
        email: user?.email,
      },
    );
    console.log(msg);
  });
