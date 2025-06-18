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

// This file defines the base class `AuthorizationCodeFlow` for handling the
// OAuth 2.0 authorization code flow. It includes methods for generating
// authorization URLs, prompting users for authorization, and exchanging
// authorization codes for tokens.

import {OAuth2Client} from 'google-auth-library';

/**
 * Base class for managing the OAuth 2.0 Authorization Code Flow.
 * It provides common logic for generating authorization URLs,
 * handling user authorization, and exchanging codes for tokens.
 * Specific implementations will override methods to define how the
 * redirect URI is obtained and how the user is prompted for the code.
 */
export class AuthorizationCodeFlow {
  protected oauth2Client: OAuth2Client;

  constructor(oauth2client: OAuth2Client) {
    this.oauth2Client = oauth2client;
  }

  /**
   * Initiates the authorization process.
   * This method generates an authorization URL, prompts the user for authorization,
   * exchanges the authorization code for tokens, and sets the credentials
   * on the OAuth2 client.
   * @param {string | string[]} scopes - The scope(s) for which authorization is requested.
   * @returns {Promise<OAuth2Client>} The authorized OAuth2 client.
   */
  async authorize(scopes: string | string[]) {
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
   * Abstract method to get the redirect URI.
   * Subclasses must implement this to provide the specific redirect URI
   * for their authorization flow.
   * @returns {Promise<string>} The redirect URI.
   * @throws {Error} If not implemented by the subclass.
   */
  async getRedirectUri(): Promise<string> {
    throw new Error('Not implemented');
  }

  /**
   * Abstract method to prompt the user for the authorization code.
   * Subclasses must implement this to define how the user is prompted
   * (e.g., via a local server, manual input).
   * @param {string} _authorizationUrl - The URL to which the user should be directed
   * for authorization.
   * @returns {Promise<string>} The authorization code obtained from the user.
   * @throws {Error} If not implemented by the subclass.
   */
  async promptAndReturnCode(_authorizationUrl: string): Promise<string> {
    throw new Error('Not implemented');
  }
}

/**
 * Parses an authorization response URL (typically from a redirect)
 * to extract the authorization code or an error.
 * @param {string} url - The full URL from the authorization server's redirect.
 * @returns {{code: string | null; error: string | null}} An object containing
 * the 'code' if successful, or an 'error' if the authorization failed.
 */
export function parseAuthResponseUrl(url: string) {
  const urlParts = new URL(url, 'http://localhost/').searchParams;
  const code = urlParts.get('code');
  const error = urlParts.get('error');
  return {
    code,
    error,
  };
}
