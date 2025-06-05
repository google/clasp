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
 * @fileoverview Implementation of the CredentialStore interface that uses the
 * local filesystem for storing and retrieving OAuth2 credentials.
 * It supports migrating from older V1 credential formats to the V3 format,
 * which includes support for multiple named credentials.
 */

import fs from 'fs';
import {CredentialStore, StoredCredential} from './credential_store.js';

/**
 * Represents the V1 local file format for `.clasprc.json`.
 * This format stored a single credential per file, typically used for local project-specific credentials.
 */
type V1LocalFileFormat = {
  token?: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  oauth2ClientSettings?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  isLocalCreds?: boolean;
};

/**
 * Represents the V1 global file format, typically found in `~/.clasprc.json`.
 * This format also stored a single credential.
 */
type V1GlobalFileFormat = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  exprity_date?: number; // Note: Typo 'exprity_date' is intentional to match legacy format.
};

/**
 * Represents the V3 file format, introduced in Clasp 3.x.
 * This format supports multiple named credentials within a single file, stored under the `tokens` key.
 */
type V3FileFormat = {
  tokens?: Record<string, StoredCredential | undefined>;
};

/**
 * Combined type representing all possible structures of the credential file,
 * allowing for graceful migration from older formats.
 */
type FileContents = V1LocalFileFormat & V1GlobalFileFormat & V3FileFormat;

/**
 * Checks if the provided store object conforms to the V1 local legacy credential format.
 * @param store The file contents to check.
 * @returns True if it matches the V1 local format, false otherwise.
 */
function hasLegacyLocalCredentials(store: FileContents): boolean {
  return Boolean(store.token && store.oauth2ClientSettings);
}

/**
 * Checks if the provided store object conforms to the V1 global legacy credential format.
 * @param store The file contents to check.
 * @returns True if it matches the V1 global format, false otherwise.
 */
function hasLegacyGlobalCredentials(store: FileContents): boolean {
  return Boolean(store.access_token);
}

/**
 * Implements the CredentialStore interface using the local filesystem.
 * Credentials are stored in a JSON file, typically `.clasprc.json`.
 */
export class FileCredentialStore implements CredentialStore {
  private filePath: string;

  /**
   * Constructs a FileCredentialStore.
   * @param filePath The path to the file where credentials will be stored.
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Saves credentials for a given user. If the user already has credentials, they are overwritten.
   * If `credentials` is undefined, it effectively deletes the user's credentials.
   * @param user The user identifier.
   * @param credentials The credentials to save, or undefined to delete.
   */
  async save(user: string, credentials?: StoredCredential): Promise<void> {
    const store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    // Ensure the tokens object exists.
    store.tokens[user] = credentials;
    this.writeFile(store);
  }

  /**
   * Deletes credentials for a specific user.
   * If deleting the 'default' user, it also clears out any V1 legacy credential formats
   * to ensure a clean state, leaving only the V3 `tokens` structure.
   * @param user The user identifier whose credentials are to be deleted.
   */
  async delete(user: string): Promise<void> {
    let store: FileContents = this.readFile();
    if (!store.tokens) {
      // If there's no 'tokens' map, there's nothing V3 to delete for this user.
      // However, we might still need to clear legacy formats if user is 'default'.
      store.tokens = {};
    }
    store.tokens[user] = undefined; // Mark the specific user's V3 credentials for deletion.

    if (user === 'default') {
      // Special handling for 'default' user: remove all legacy V1 keys.
      // This ensures that after deleting 'default', the file only contains the 'tokens' field (or is empty).
      const newStore: V3FileFormat = {tokens: store.tokens};
      this.writeFile(newStore);
    } else {
      // For non-default users, just update the store with the specific user's V3 token removed.
      this.writeFile(store);
    }
  }

  /**
   * Deletes all credentials from the store, effectively resetting it to an empty V3 format.
   */
  async deleteAll(): Promise<void> {
    // Overwrites the file with an empty tokens object.
    await this.writeFile({
      tokens: {},
    });
  }

  /**
   * Loads credentials for a given user.
   * It first attempts to load from the V3 format. If not found and the user is 'default',
   * it attempts to load from V1 local and then V1 global legacy formats.
   * @param user The user identifier.
   * @returns A promise that resolves to the StoredCredential if found, otherwise null.
   */
  async load(user: string): Promise<StoredCredential | null> {
    const storeContents: FileContents = this.readFile();

    // Try V3 format first
    const v3Credentials = storeContents.tokens?.[user];
    if (v3Credentials) {
      return v3Credentials as StoredCredential;
    }

    // If user is not 'default', and no V3 token was found, return null.
    // Legacy formats are only checked for the 'default' user.
    if (user !== 'default') {
      return null;
    }

    // Try V1 local legacy format for 'default' user
    if (hasLegacyLocalCredentials(storeContents) && storeContents.token) {
      // Convert V1 local format to StoredCredential
      return {
        type: 'authorized_user',
        ...storeContents.token, // Spreads access_token, refresh_token, etc.
        client_id: storeContents.oauth2ClientSettings?.clientId,
        client_secret: storeContents.oauth2ClientSettings?.clientSecret,
      };
    }

    // Try V1 global legacy format for 'default' user
    if (hasLegacyGlobalCredentials(storeContents)) {
      // Convert V1 global format to StoredCredential
      return {
        type: 'authorized_user',
        access_token: storeContents.access_token,
        refresh_token: storeContents.refresh_token,
        expiry_date: storeContents.exprity_date, // Matches legacy typo
        token_type: storeContents.token_type,
        // V1 global format used hardcoded client_id and client_secret
        client_id: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
        client_secret: 'v6V3fKV_zWU7iw1DrpO1rknX',
      };
    }

    return null; // No credentials found for the user
  }

  /**
   * Reads the credential file from disk.
   * @returns The parsed file contents, or an empty object if the file does not exist.
   */
  private readFile(): FileContents {
    if (fs.existsSync(this.filePath)) {
      // TODO - use promises for fs operations for consistency if other async fs ops are introduced.
      const content = fs.readFileSync(this.filePath, {encoding: 'utf8'});
      try {
        return JSON.parse(content) as FileContents;
      } catch (error) {
        // Handle cases where the file content is not valid JSON.
        console.error(`Error parsing credential file ${this.filePath}:`, error);
        return {}; // Return empty or default structure on parse error.
      }
    }
    return {}; // Return empty object if file doesn't exist.
  }

  /**
   * Writes the given store object to the credential file.
   * @param store The FileContents object to write to disk.
   */
  private writeFile(store: FileContents): void {
    // TODO - use promises for fs operations for consistency.
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }
}
