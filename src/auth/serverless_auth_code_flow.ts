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

// This file implements the `AuthorizationCodeFlow` for serverless
// environments where a local HTTP server cannot be used. It prompts the user
// to manually open an authorization URL and paste back the authorization code.

import {OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';
import {intl} from '../intl.js';
import {AuthorizationCodeFlow, parseAuthResponseUrl} from './auth_code_flow.js';

/**
 * Implements the Authorization Code Flow for environments where a local
 * server cannot be started (e.g., serverless functions, some CI environments).
 * It prompts the user to manually open the authorization URL in a browser
 * on another device and then paste the resulting redirect URL (containing
 * the authorization code) back into the CLI.
 */
export class ServerlessAuthorizationCodeFlow extends AuthorizationCodeFlow {
  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

  /**
   * Returns a hardcoded redirect URI.
   * This URI is typically configured in the OAuth client settings in GCP Console
   * and is used by Google's authorization server to redirect the user after
   * successful authorization.
   * @returns {Promise<string>} The redirect URI.
   */
  async getRedirectUri(): Promise<string> {
    return 'http://localhost:8888';
  }

  /**
   * Prompts the user to manually open the authorization URL in a browser
   * on another device and then paste the resulting redirect URL (which contains
   * the authorization code) back into the CLI.
   * @param {string} authorizationUrl - The URL to display to the user for authorization.
   * @returns {Promise<string>} The authorization code extracted from the URL pasted by the user.
   * @throws {Error} If the pasted URL contains an error or no code.
   */
  async promptAndReturnCode(authorizationUrl: string) {
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
      throw new Error(error);
    }
    if (!code) {
      const msg = intl.formatMessage({
        defaultMessage: 'Missing code in responde URL',
      });
      throw new Error(msg);
    }
    return code;
  }
}
