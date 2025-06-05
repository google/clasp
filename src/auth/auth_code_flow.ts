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

import {OAuth2Client} from 'google-auth-library';

export class AuthorizationCodeFlow {
  protected oauth2Client: OAuth2Client;

  constructor(oauth2client: OAuth2Client) {
    this.oauth2Client = oauth2client;
  }

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

  async getRedirectUri(): Promise<string> {
    throw new Error('Not implemented');
  }

  async promptAndReturnCode(_authorizationUrl: string): Promise<string> {
    throw new Error('Not implemented');
  }
}

export function parseAuthResponseUrl(url: string) {
  const urlParts = new URL(url, 'http://localhost/').searchParams;
  const code = urlParts.get('code');
  const error = urlParts.get('error');
  return {
    code,
    error,
  };
}
