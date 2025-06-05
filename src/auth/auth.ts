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

import {readFileSync} from 'fs';
import os from 'os';
import path from 'path';
import Debug from 'debug';
import {GoogleAuth, OAuth2Client} from 'google-auth-library';
import {google} from 'googleapis';
import {AuthorizationCodeFlow} from './auth_code_flow.js';
import {CredentialStore} from './credential_store.js';
import {FileCredentialStore} from './file_credential_store.js';
import {LocalServerAuthorizationCodeFlow} from './localhost_auth_code_flow.js';
import {ServerlessAuthorizationCodeFlow} from './serverless_auth_code_flow.js';

const debug = Debug('clasp:auth');

type InitOptions = {
  authFilePath?: string;
  userKey?: string;
  useApplicationDefaultCredentials?: boolean;
};

export type AuthInfo = {
  credentials?: OAuth2Client;
  credentialStore?: CredentialStore;
  user: string;
};

export async function initAuth(options: InitOptions): Promise<AuthInfo> {
  const authFilePath = options.authFilePath ?? path.join(os.homedir(), '.clasprc.json');
  const credentialStore = new FileCredentialStore(authFilePath);

  debug('Initializng auth from %s', options.authFilePath);
  if (options.useApplicationDefaultCredentials) {
    const credentials = await createApplicationDefaultCredentials();
    return {
      credentials,
      credentialStore,
      user: options.userKey ?? 'default',
    };
  }

  const credentials = await getAuthorizedOAuth2Client(credentialStore, options.userKey);
  return {
    credentials,
    credentialStore,
    user: options.userKey ?? 'default',
  };
}

export async function getUserInfo(credentials: OAuth2Client) {
  debug('Fetching user info');
  const api = google.oauth2('v2');
  try {
    const res = await api.userinfo.get({auth: credentials});
    if (!res.data) {
      debug('No user info returned');
      return undefined;
    }
    return {
      email: res.data.email,
      id: res.data.id,
    };
  } catch (err) {
    debug('Error while fetching userinfo: %O', err);
    return undefined;
  }
}

/**
 * Creates an an unauthorized oauth2 client given the client secret file. If no path is provided,
 * teh default client is returned.
 * @param clientSecretPath
 * @returns
 */
export function getUnauthorizedOuth2Client(clientSecretPath?: string): OAuth2Client {
  if (clientSecretPath) {
    return createOauthClient(clientSecretPath);
  }
  return createDefaultOAuthClient();
}

/**
 * Create an authorized oauth2 client from saved credentials.
 * @param userKey
 * @returns
 */
export async function getAuthorizedOAuth2Client(
  store: CredentialStore,
  userKey?: string,
): Promise<OAuth2Client | undefined> {
  if (!userKey) {
    userKey = 'default';
  }

  debug('Loading credentials for user %s', userKey);

  const savedCredentials = await store.load(userKey);
  if (!savedCredentials) {
    debug('No saved credentials found.');
    return undefined;
  }

  const client = new GoogleAuth().fromJSON(savedCredentials) as OAuth2Client;
  client.setCredentials(savedCredentials);
  client.on('tokens', async tokens => {
    debug('Saving refreshed token for user %s', userKey);
    const refreshedCredentials = {
      ...savedCredentials,
      expiry_date: tokens.expiry_date,
      access_token: tokens.access_token,
      id_token: tokens.access_token,
    };
    await store.save(userKey!, refreshedCredentials);
  });
  return client;
}

export type AuthorizationOptions = {
  noLocalServer?: boolean;
  redirectPort?: number;
  scopes: string[] | string;
  oauth2Client: OAuth2Client;
  store: CredentialStore;
  userKey: string;
};

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] List of OAuth scopes to authorize.
 * @param {number?} redirectPort Optional custom port for the local HTTP server during the authorization process.
 *                               If not specified, a random available port will be used.
 */
export async function authorize(options: AuthorizationOptions) {
  let flow: AuthorizationCodeFlow;
  if (options.noLocalServer) {
    debug('Starting auth with serverless flow');
    flow = new ServerlessAuthorizationCodeFlow(options.oauth2Client);
  } else {
    debug('Starting auth with local server flow');
    flow = new LocalServerAuthorizationCodeFlow(options.oauth2Client);
  }

  const client = await flow.authorize(options.scopes);
  await saveOauthClientCredentials(options.store, options.userKey, client);
  debug('Auth complete');
  return client;
}

async function saveOauthClientCredentials(store: CredentialStore, userKey: string, oauth2Client: OAuth2Client) {
  const savedCredentials = {
    client_id: oauth2Client._clientId,
    client_secret: oauth2Client._clientSecret,
    type: 'authorized_user',
    refresh_token: oauth2Client.credentials.refresh_token ?? undefined,
    access_token: oauth2Client.credentials.access_token ?? undefined,
  };
  oauth2Client.on('tokens', async tokens => {
    const refreshedCredentials = {
      ...savedCredentials,
      expiry_date: tokens.expiry_date,
      access_token: tokens.access_token,
      id_token: tokens.access_token,
    };
    debug('Saving refreshed credentials for user %s', userKey);
    await store.save(userKey, refreshedCredentials);
  });
  debug('Saving credentials for user %s', userKey);
  await store.save(userKey, savedCredentials);
}

/**
 * Creates an aunthorized oauth2 client with the given credentials
 * @param clientSecretPath
 * @returns
 */
function createOauthClient(clientSecretPath: string) {
  debug('Creating new oauth client from %s', clientSecretPath);
  if (!clientSecretPath) {
    throw new Error('Invalid credentials');
  }
  const contents = readFileSync(clientSecretPath);
  const keyFile = JSON.parse(contents.toString());
  const keys = keyFile.installed || keyFile.web;
  if (!keys.redirect_uris || keys.redirect_uris.length === 0) {
    throw new Error('Invalid redirect URL');
  }
  const redirectUrl = keys.redirect_uris.find((uri: string) => new URL(uri).hostname === 'localhost');
  if (!redirectUrl) {
    throw new Error('No localhost redirect URL found');
  }
  // create an oAuth client to authorize the API call
  const client = new OAuth2Client({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri: redirectUrl,
  });
  debug('Created built-in oauth client, id: %s', client._clientId);
  return client;
}

/**
 * Creates an aunthorized oauth2 client using the default id & secret.
 * @param clientSecretPath
 * @returns
 */
function createDefaultOAuthClient() {
  // Default client
  const client = new OAuth2Client({
    clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
    clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
    redirectUri: 'http://localhost',
  });
  debug('Created built-in oauth client, id: %s', client._clientId);
  return client;
}

export async function createApplicationDefaultCredentials() {
  const defaultCreds = await new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
      'https://www.googleapis.com/auth/script.projects', // Apps Script management
      'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
      'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
      'https://www.googleapis.com/auth/drive.file', // Create Drive files
      'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
      'https://www.googleapis.com/auth/logging.read', // StackDriver logs
      'https://www.googleapis.com/auth/userinfo.email', // User email address
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  }).getClient();
  // Remove this check after https://github.com/googleapis/google-auth-library-nodejs/issues/1677 fixed
  if (defaultCreds instanceof OAuth2Client) {
    debug('Created service account credentials, id: %s', defaultCreds._clientId);
    return defaultCreds as OAuth2Client;
  }
  return undefined;
}
