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
 * @fileoverview Defines the interface for storing and retrieving user credentials.
 * This allows for different storage mechanisms (e.g., file-based, in-memory)
 * to be used interchangeably.
 */

import {Credentials, JWTInput} from 'google-auth-library';

/**
 * Represents the structure of credentials as they are stored.
 * It combines JWT input properties with general OAuth2 credentials.
 */
export type StoredCredential = JWTInput & Credentials;

/**
 * Interface for a credential storage mechanism.
 * Implementations of this interface are responsible for persisting and retrieving
 * OAuth2 credentials.
 */
export interface CredentialStore {
  /**
   * Saves the given credentials for a specific user.
   * @param user The identifier for the user (e.g., 'default' or a user-specific key).
   * @param credentials The credentials to save.
   * @returns A promise that resolves when the credentials have been saved.
   */
  save(user: string, credentials: StoredCredential): Promise<void>;

  /**
   * Deletes the credentials for a specific user.
   * @param user The identifier for the user whose credentials should be deleted.
   * @returns A promise that resolves when the credentials have been deleted.
   */
  delete(user: string): Promise<void>;

  /**
   * Deletes all stored credentials.
   * @returns A promise that resolves when all credentials have been deleted.
   */
  deleteAll(): Promise<void>;

  /**
   * Loads the credentials for a specific user.
   * @param user The identifier for the user whose credentials should be loaded.
   * @returns A promise that resolves with the stored credentials, or null if not found.
   */
  load(user: string): Promise<StoredCredential | null>;
}
