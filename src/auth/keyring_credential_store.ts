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

import {AsyncEntry, findCredentialsAsync} from '@napi-rs/keyring';
import {CredentialStore, StoredCredential} from './credential_store.js';

const SERVICE_NAME = 'clasp';

/**
 * Implements the `CredentialStore` interface using the system keyring.
 * This class handles saving, loading, and deleting OAuth 2.0 credentials
 * using the `@napi-rs/keyring` package.
 */
export class KeyringCredentialStore implements CredentialStore {
  /**
   * Saves credentials for a given user in the system keyring.
   * If credentials are provided as undefined, it effectively removes the user's credentials.
   * @param {string} user - The identifier for the user.
   * @param {StoredCredential | undefined} credentials - The credentials to save, or undefined to clear.
   * @returns {Promise<void>}
   */
  async save(user: string, credentials?: StoredCredential): Promise<void> {
    const entry = new AsyncEntry(SERVICE_NAME, user);
    if (credentials) {
      await entry.setPassword(JSON.stringify(credentials));
    } else {
      try {
        await entry.deletePassword();
      } catch (e: any) {
        // Ignore NoEntry errors when deleting
      }
    }
  }

  /**
   * Deletes credentials for a specific user from the system keyring.
   * @param {string} user - The identifier for the user whose credentials are to be deleted.
   * @returns {Promise<void>}
   */
  async delete(user: string): Promise<void> {
    const entry = new AsyncEntry(SERVICE_NAME, user);
    try {
      await entry.deletePassword();
    } catch (e: any) {
      // Ignore NoEntry errors when deleting
    }
  }

  /**
   * Deletes all stored credentials for the clasp service from the system keyring.
   * @returns {Promise<void>}
   */
  async deleteAll(): Promise<void> {
    const credentials = await findCredentialsAsync(SERVICE_NAME);
    for (const cred of credentials) {
      const entry = new AsyncEntry(SERVICE_NAME, cred.account);
      try {
        await entry.deletePassword();
      } catch (e: any) {
        // Ignore NoEntry errors
      }
    }
  }

  /**
   * Loads credentials for a given user from the system keyring.
   * @param {string} user - The identifier for the user.
   * @returns {Promise<StoredCredential | null>} The stored credentials if found, otherwise null.
   */
  async load(user: string): Promise<StoredCredential | null> {
    const entry = new AsyncEntry(SERVICE_NAME, user);
    try {
      const password = await entry.getPassword();
      if (password) {
        return JSON.parse(password) as StoredCredential;
      }
      return null;
    } catch (e: any) {
      return null;
    }
  }
}
