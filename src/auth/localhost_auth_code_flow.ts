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

// This file implements the `AuthorizationCodeFlow` for local development
// environments. It starts a local HTTP server to receive the authorization
// code after the user grants permission.

import {createServer} from 'http';
import type {IncomingMessage, Server, ServerResponse} from 'http';
import type {AddressInfo} from 'net';
import {OAuth2Client} from 'google-auth-library';
import open from 'open';
import enableDestroy from 'server-destroy';
import {intl} from '../intl.js';
import {AuthorizationCodeFlow, parseAuthResponseUrl} from './auth_code_flow.js';

/**
 * Implements the Authorization Code Flow by starting a local HTTP server
 * to act as the redirect URI. This is suitable for CLI environments
 * where a browser can be opened and a local server can receive the
 * authorization code.
 */
export class LocalServerAuthorizationCodeFlow extends AuthorizationCodeFlow {
  protected server: Server | undefined;
  protected port = 0;

  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

  /**
   * Starts a local HTTP server and returns its address as the redirect URI.
   * The server will listen on the configured port (or a random available port if 0).
   * @returns {Promise<string>} The local redirect URI (e.g., "http://localhost:1234").
   * @throws {Error} If the server cannot be started (e.g., port in use).
   */
  async getRedirectUri(): Promise<string> {
    this.server = await new Promise<Server>((resolve, reject) => {
      const s = createServer();
      enableDestroy(s);
      s.listen(this.port, () => resolve(s)).on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          const msg = intl.formatMessage(
            {
              defaultMessage:
                'Error: Port {port} is already in use. Please specify a different port with --redirect-port',
            },
            {
              port: this.port,
            },
          );
          console.error(msg);
        } else {
          const msg = intl.formatMessage(
            {
              defaultMessage: 'Error: Unable to start the server on port {port}',
            },
            {
              port: this.port,
              errorMessage: err.message,
            },
          );
          console.error(msg, err.message);
        }
        reject(err);
      });
    });
    const {port} = this.server.address() as AddressInfo;
    return `http://localhost:${port}`;
  }

  /**
   * Prompts the user to authorize by opening the provided authorization URL
   * in their default web browser. It then waits for the local server (started by
   * `getRedirectUri`) to receive the callback containing the authorization code.
   * @param {string} authorizationUrl - The URL to open for user authorization.
   * @returns {Promise<string>} The authorization code extracted from the redirect.
   * @throws {Error} If the server is not started, the request URL is missing, or an error
   * parameter is present in the redirect URL.
   */
  async promptAndReturnCode(authorizationUrl: string) {
    return await new Promise<string>((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not started'));
        return;
      }
      this.server.on('request', (request: IncomingMessage, response: ServerResponse) => {
        if (!request.url) {
          reject(new Error('Missing URL in request'));
          return;
        }
        const {code, error} = parseAuthResponseUrl(request.url);
        if (code) {
          resolve(code);
        } else {
          reject(error);
        }
        const msg = intl.formatMessage({
          defaultMessage: 'Logged in! You may close this page.',
        });
        response.end(msg);
      });
      void open(authorizationUrl);

      const msg = intl.formatMessage(
        {
          defaultMessage: '`🔑 Authorize clasp by visiting this url:\n{url}\n',
        },
        {
          url: authorizationUrl,
        },
      );
      console.log(msg);
    }).finally(() => this.server?.destroy());
  }
}
