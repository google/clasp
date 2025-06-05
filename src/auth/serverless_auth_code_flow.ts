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
 * @fileoverview Implements the OAuth2 authorization code flow for serverless environments
 * or scenarios where a local HTTP server cannot be used. This flow requires the user
 * to manually open the authorization URL, authorize the application, and then
 * paste the callback URL (containing the authorization code) back into the terminal.
 */

import {OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';
import {intl} from '../intl.js';
import {AuthorizationCodeFlow, parseAuthResponseUrl} from './auth_code_flow.js';

/**
 * Implements the OAuth2 authorization code flow for serverless environments.
 * This flow guides the user to manually perform the authorization steps
 * in a browser and paste the resulting URL back into the CLI.
 */
export class ServerlessAuthorizationCodeFlow extends AuthorizationCodeFlow {
  /**
   * Constructs a ServerlessAuthorizationCodeFlow.
   * @param oauth2client The OAuth2Client instance.
   */
  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

  /**
   * Returns a fixed redirect URI.
   * For the serverless flow, a consistent, though not actively listened, redirect URI is used.
   * The user will be redirected here after authorization and must copy this URL.
   * @returns A promise that resolves with "http://localhost:8888".
   */
  async getRedirectUri(): Promise<string> {
    // This URI must be one of the authorized redirect URIs configured in your OAuth client in GCP.
    return 'http://localhost:8888';
  }

  /**
   * Prompts the user to open the authorization URL in a browser, authorize,
   * and then paste the full redirect URL (containing the authorization code)
   * back into the terminal.
   * @param authorizationUrl The URL to provide to the user for authorization.
   * @returns A promise that resolves with the extracted authorization code.
   * @throws An error if the pasted URL does not contain an authorization code or contains an error.
   */
  async promptAndReturnCode(authorizationUrl: string): Promise<string> {
    const prompt = intl.formatMessage(
      {
        defaultMessage: `Authorize clasp by visiting the following URL on another device:\n
     \t{url}\n\nAfter authorization, copy the URL in the browser.\n
     Enter the URL from your browser after completing authorization`,
      },
      {
        url: authorizationUrl,
      },
    );
    const answer = await inquirer.prompt([
      {
        message: prompt,
        name: 'url',
        type: 'input',
      },
    ]);
    const {code, error} = parseAuthResponseUrl(answer.url);
    if (error) {
      // If the callback URL contains an error parameter, throw it.
      throw new Error(`Authorization failed: ${error}`);
    }
    if (!code) {
      // If no code and no error, the URL was likely malformed or pasted incorrectly.
      const msg = intl.formatMessage({
        defaultMessage: 'Missing authorization code in the provided URL. Please ensure you copy the full URL after authorization.',
      });
      throw new Error(msg);
    }
    return code;
  }
}
