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

// This file defines the `CredentialStore` interface, which outlines the
// contract for storing, retrieving, and deleting user credentials.

import {Credentials, JWTInput} from 'google-auth-library';

/**
 * Represents the structure of credentials as stored by the credential store.
 * It combines JWT input properties (like client ID, client secret) with
 * OAuth 2.0 credentials (like access token, refresh token, expiry date).
 * @property {string} [client_id] - The client ID.
 * @property {string} [client_secret] - The client secret.
 * @property {string} [refresh_token] - The refresh token.
 * @property {string} [access_token] - The access token.
 * @property {number} [expiry_date] - The expiry date of the access token in milliseconds.
 * @property {string} [type] - The type of credential, e.g., 'authorized_user'.
 * @property {string} [id_token] - The ID token (often same as access_token for clasp's use).
 */
export type StoredCredential = JWTInput & Credentials;

/**
 * Defines the contract for a credential storage mechanism.
 * Implementations of this interface are responsible for persisting
 * and retrieving user credentials.
 */
export interface CredentialStore {
  /**
   * Saves the given credentials for the specified user.
   * @param {string} user - The identifier for the user.
   * @param {StoredCredential} credentials - The credentials to save.
   * @returns {Promise<void>}
   */
  save(user: string, credentials: StoredCredential): Promise<void>;

  /**
   * Deletes the credentials for the specified user.
   * @param {string} user - The identifier for the user.
   * @returns {Promise<void>}
   */
  delete(user: string): Promise<void>;
  /**
   * Deletes all credentials from the store.
   * @returns {Promise<void>}
   */
  deleteAll(): Promise<void>;

  /**
   * Loads the credentials for the specified user.
   * @param {string} user - The identifier for the user.
   * @returns {Promise<StoredCredential | null>} The stored credentials, or null if not found.
   */
  load(user: string): Promise<StoredCredential | null>;
}
