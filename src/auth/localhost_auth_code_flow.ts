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

import {createServer} from 'http';
import type {IncomingMessage, Server, ServerResponse} from 'http';
import type {AddressInfo} from 'net';
import {OAuth2Client} from 'google-auth-library';
import open from 'open';
import enableDestroy from 'server-destroy';
import {intl} from '../intl.js';
import {AuthorizationCodeFlow, parseAuthResponseUrl} from './auth_code_flow.js';

export class LocalServerAuthorizationCodeFlow extends AuthorizationCodeFlow {
  protected server: Server | undefined;
  protected port = 0;

  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

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
