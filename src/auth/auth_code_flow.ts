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
 * @fileoverview Base class for OAuth2 authorization code flows.
 * This file provides the core structure for different authorization strategies,
 * such as local server-based or serverless (manual copy-paste) flows.
 */

import {OAuth2Client} from 'google-auth-library';

/**
 * Base class for handling the OAuth2 authorization code flow.
 * Subclasses should implement `getRedirectUri` and `promptAndReturnCode`.
 */
export class AuthorizationCodeFlow {
  protected oauth2Client: OAuth2Client;

  /**
   * Constructs an instance of AuthorizationCodeFlow.
   * @param oauth2client The OAuth2Client to be used for authorization.
   */
  constructor(oauth2client: OAuth2Client) {
    this.oauth2Client = oauth2client;
  }

  /**
   * Initiates the authorization process for the given scopes.
   * This method generates an authorization URL, prompts the user for authorization,
   * retrieves the authorization code, and exchanges it for tokens.
   * @param scopes The scope or array of scopes for which authorization is requested.
   * @returns A promise that resolves with the authorized OAuth2Client.
   */
  async authorize(scopes: string | string[]): Promise<OAuth2Client> {
    const scope = Array.isArray(scopes) ? scopes.join(' ') : scopes;
    const redirectUri = await this.getRedirectUri();
    const authUrl = this.oauth2Client.generateAuthUrl({
      redirect_uri: redirectUri,
      access_type: 'offline',
      scope: scope,
    });
    const code = await this.promptAndReturnCode(authUrl);
    const tokens = await this.oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });
    this.oauth2Client.setCredentials(tokens.tokens);
    return this.oauth2Client;
  }

  /**
   * Gets the redirect URI for the authorization flow.
   * This method must be implemented by subclasses.
   * @returns A promise that resolves with the redirect URI string.
   * @throws Error if not implemented by the subclass.
   */
  async getRedirectUri(): Promise<string> {
    // This is a placeholder and should be overridden by subclasses.
    throw new Error('getRedirectUri method not implemented.');
  }

  /**
   * Prompts the user for authorization using the provided URL and returns the authorization code.
   * This method must be implemented by subclasses.
   * @param _authorizationUrl The URL to which the user should be directed for authorization.
   * @returns A promise that resolves with the authorization code.
   * @throws Error if not implemented by the subclass.
   */
  async promptAndReturnCode(_authorizationUrl: string): Promise<string> {
    // This is a placeholder and should be overridden by subclasses.
    throw new Error('promptAndReturnCode method not implemented.');
  }
}

/**
 * Parses the authorization response URL to extract the authorization code or an error.
 * @param url The complete URL string from the authorization response.
 * @returns An object containing the `code` and `error`, if present in the URL.
 *          `code` will be the authorization code.
 *          `error` will be the error message from the `error` query parameter.
 *          Both can be null if not present.
 */
export function parseAuthResponseUrl(url: string): {code: string | null; error: string | null} {
  const urlParts = new URL(url, 'http://localhost/').searchParams;
  const code = urlParts.get('code');
  const error = urlParts.get('error');
  return {
    code,
    error,
  };
}
