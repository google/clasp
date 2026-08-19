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
import {FileCredentialStore} from '../auth/file_credential_store.js';
import {KeyringCredentialStore} from '../auth/keyring_credential_store.js';
import {GlobalOptions} from './utils.js';
import {intl} from '../intl.js';

interface CommandOptions extends GlobalOptions {}

export const command = new Command('export-credentials')
  .description('Export credentials from the system keyring into a file')
  .action(async function (this: Command): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();

    const keyringStore = new KeyringCredentialStore();
    const os = await import('os');
    const path = await import('path');
    const authFilePath = options.auth ?? path.join(os.homedir(), '.clasprc.json');
    const fileStore = new FileCredentialStore(authFilePath);

    const users = await keyringStore.listUsers();

    if (users.length === 0) {
      const msg = intl.formatMessage({
        defaultMessage: 'No credentials found in the system keyring to export.',
      });
      this.error(msg);
    }

    for (const user of users) {
      const credentials = await keyringStore.load(user);
      if (credentials) {
        await fileStore.save(user, credentials);
        await keyringStore.delete(user);

        const msg = intl.formatMessage({
          defaultMessage: 'Successfully exported credentials for user "{user}" from the system keyring to a file.',
        }, {user});
        console.log(msg);
      }
    }
  });
