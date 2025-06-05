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
 * @fileoverview Implements the OAuth2 authorization code flow using a local HTTP server.
 * This flow starts a local server to listen for the authorization callback,
 * opens the authorization URL in the user's browser, and then captures the
 * authorization code from the callback.
 */

import {createServer} from 'http';
import type {IncomingMessage, Server, ServerResponse} from 'http';
import type {AddressInfo} from 'net';
import {OAuth2Client} from 'google-auth-library';
import open from 'open';
import enableDestroy from 'server-destroy';
import {intl} from '../intl.js';
import {AuthorizationCodeFlow, parseAuthResponseUrl} from './auth_code_flow.js';

/**
 * Implements the OAuth2 authorization code flow by starting a local HTTP server
 * to receive the authorization code.
 */
export class LocalServerAuthorizationCodeFlow extends AuthorizationCodeFlow {
  protected server: Server | undefined;
  protected port: number;

  /**
   * Constructs a LocalServerAuthorizationCodeFlow.
   * @param oauth2client The OAuth2Client instance.
   * @param port The port to use for the local server. Defaults to 0 (OS-assigned).
   */
  constructor(oauth2client: OAuth2Client, port = 0) {
    super(oauth2client);
    this.port = port;
  }

  /**
   * Starts a local HTTP server and returns its address as the redirect URI.
   * The server will listen on the port specified in the constructor, or an OS-assigned port if 0.
   * @returns A promise that resolves with the local redirect URI (e.g., "http://localhost:12345").
   * @throws An error if the server cannot be started (e.g., port already in use).
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
   * Opens the authorization URL in the user's default browser and starts listening
   * on the local server for the callback request containing the authorization code.
   * @param authorizationUrl The URL to open in the browser for user authorization.
   * @returns A promise that resolves with the authorization code extracted from the callback.
   * @throws An error if the server is not started or if the callback URL doesn't contain a code.
   */
  async promptAndReturnCode(authorizationUrl: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.server) {
        // This should ideally not happen if getRedirectUri was called successfully.
        reject(new Error('Local server not started. Call getRedirectUri first.'));
        return;
      }
      this.server.on('request', (request: IncomingMessage, response: ServerResponse) => {
        // Handles the incoming request from the OAuth provider's redirect.
        if (!request.url) {
          // Should always have a URL in a valid HTTP request.
          response.writeHead(400, {'Content-Type': 'text/plain'});
          response.end('Error: Missing URL in request.');
          reject(new Error('Missing URL in callback request.'));
          return;
        }

        const {code, error} = parseAuthResponseUrl(request.url);

        if (error) {
          response.writeHead(400, {'Content-Type': 'text/plain'});
          response.end(`Error during authorization: ${error}`);
          reject(new Error(`Authorization error: ${error}`));
          return;
        }

        if (code) {
          const successMsg = intl.formatMessage({
            defaultMessage: 'Logged in! You may close this page.',
          });
          response.writeHead(200, {'Content-Type': 'text/plain'});
          response.end(successMsg);
          resolve(code);
        } else {
          // Should not happen if error is also null, but handle defensively.
          const errorMsg = intl.formatMessage({defaultMessage: 'Authorization code not found in callback.'});
          response.writeHead(400, {'Content-Type': 'text/plain'});
          response.end(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      // Open the authorization URL in the browser.
      void open(authorizationUrl);

      const logMsg = intl.formatMessage(
        {
          defaultMessage: '🔑 Authorize clasp by visiting this url:\n{url}\n',
        },
        {
          url: authorizationUrl,
        },
      );
      console.log(logMsg); // Inform user to check their browser.
    }).finally(() => {
      // Ensure the server is destroyed after the promise settles (resolve or reject).
      if (this.server) {
        this.server.destroy();
        this.server = undefined;
      }
    });
  }
}
