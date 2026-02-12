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

// This file implements the `CredentialStore` interface, providing a file-based
// mechanism for storing and managing user credentials. It handles different
// file formats for compatibility with older versions of clasp.

import fs from 'fs';
import {CredentialStore, StoredCredential} from './credential_store.js';
import {DEFAULT_CLASP_OAUTH_CLIENT_ID, DEFAULT_CLASP_OAUTH_CLIENT_SECRET} from './oauth_client.js';

// Initial .clasprc.json format, single credential per file
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

type V1GlobalFileFormat = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  exprity_date?: number;
};

// Clasp 3.x format, support for named credentials
type V3FileFormat = {
  tokens?: Record<string, StoredCredential | undefined>;
};

type FileContents = V1LocalFileFormat & V1GlobalFileFormat & V3FileFormat;

function hasLegacyLocalCredentials(store: FileContents) {
  return store.token && store.oauth2ClientSettings;
}

function hasLegacyGlobalCredentials(store: FileContents) {
  return !!store.access_token;
}

/**
 * Implements the `CredentialStore` interface using a local JSON file.
 * This class handles saving, loading, and deleting OAuth 2.0 credentials
 * for different users. It also supports migrating credentials from older
 * clasp file formats.
 */
export class FileCredentialStore implements CredentialStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Saves credentials for a given user.
   * If credentials are provided as undefined, it effectively removes the user's credentials.
   * @param {string} user - The identifier for the user.
   * @param {StoredCredential | undefined} credentials - The credentials to save, or undefined to clear.
   * @returns {Promise<void>}
   */
  async save(user: string, credentials?: StoredCredential) {
    const store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = credentials;
    this.writeFile(store);
  }

  /**
   * Deletes credentials for a specific user.
   * If deleting the 'default' user, it also cleans up legacy credential formats.
   * @param {string} user - The identifier for the user whose credentials are to be deleted.
   * @returns {Promise<void>}
   */
  async delete(user: string) {
    let store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = undefined;

    if (user === 'default') {
      // If the 'default' user's token is deleted, we also clean up any potential
      // top-level V1 credential keys to ensure a clean state and prevent
      // V1 credentials from being loaded unintentionally after a V3 'default' delete.
      store = {
        tokens: store.tokens, // Keep other named tokens if they exist
      };
    }
    this.writeFile(store);
  }

  /**
   * Deletes all stored credentials by clearing the tokens map.
   * @returns {Promise<void>}
   */
  async deleteAll() {
    await this.writeFile({
      tokens: {},
    });
  }

  /**
   * Loads credentials for a given user.
   * It supports loading credentials from the current format as well as
   * attempting to load from legacy V1 local and global file formats
   * if the user is 'default' and no V3 credentials are found.
   * @param {string} user - The identifier for the user.
   * @returns {Promise<StoredCredential | null>} The stored credentials if found, otherwise null.
   */
  async load(user: string): Promise<StoredCredential | null> {
    const store: FileContents = this.readFile();
    const credentials = store.tokens?.[user] as StoredCredential;
    if (credentials) {
      return credentials; // Modern V3 token found for the user.
    }

    // The following logic attempts to load legacy V1 credentials
    // ONLY if the requested user is 'default' and no V3 'default' token was found.
    if (user !== 'default') {
      return null; // For non-default users, only V3 tokens are considered.
    }

    // Check for V1 local file format (usually from older .clasprc.json in project root)
    if (hasLegacyLocalCredentials(store)) {
      // Convert V1 local format to StoredCredential format.
      return {
        type: 'authorized_user',
        ...store.token, // Spread V1 token properties
        client_id: store.oauth2ClientSettings?.clientId,
        client_secret: store.oauth2ClientSettings?.clientSecret,
      };
    }
    // Check for V1 global file format (usually from older ~/.clasprc.json)
    if (hasLegacyGlobalCredentials(store)) {
      // Convert V1 global format to StoredCredential format.
      // Note: Default client_id and client_secret are used here as global V1 didn't store them.
      return {
        type: 'authorized_user',
        access_token: store.access_token, // Map V1 fields
        refresh_token: store.refresh_token,
        expiry_date: store.exprity_date,
        token_type: store.token_type,
        client_id: DEFAULT_CLASP_OAUTH_CLIENT_ID,
        client_secret: DEFAULT_CLASP_OAUTH_CLIENT_SECRET,
      };
    }
    return null;
  }

  private readFile(): FileContents {
    if (fs.existsSync(this.filePath)) {
      // TODO - use promises
      const content = fs.readFileSync(this.filePath, {encoding: 'utf8'});
      return JSON.parse(content);
    }
    return {};
  }

  private writeFile(store: FileContents) {
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }
}
