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

// This file contains functions for initializing and managing authentication,
// including OAuth2 client creation, authorization flows, and credential storage.

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

/**
 * Holds authentication information for the current session.
 * @property {OAuth2Client} [credentials] - The authorized OAuth2 client, if logged in.
 * @property {CredentialStore} [credentialStore] - The store used for loading/saving credentials.
 * @property {string} user - The identifier for the current user (e.g., 'default' or a custom key).
 */
export type AuthInfo = {
  credentials?: OAuth2Client;
  credentialStore?: CredentialStore;
  user: string;
};

/**
 * Initializes authentication, loading credentials if available or preparing for a new auth flow.
 * @param {InitOptions} options - Options for initializing authentication.
 * @param {string} [options.authFilePath] - Path to the credentials file. Defaults to ~/.clasprc.json.
 * @param {string} [options.userKey] - Identifier for the user credentials to load. Defaults to 'default'.
 * @param {boolean} [options.useApplicationDefaultCredentials] - Whether to use Application Default Credentials.
 * @returns {Promise<AuthInfo>} An AuthInfo object with the credential store and potentially loaded credentials.
 */
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

/**
 * Fetches user information (email, ID) using the provided OAuth2 client.
 * @param {OAuth2Client} credentials - An authorized OAuth2 client.
 * @returns {Promise<{email?: string | null; id?: string | null} | undefined>}
 * User's email and ID, or undefined if an error occurs or no data is returned.
 */
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
 * @param {string} [clientSecretPath] - Optional path to a client secrets JSON file.
 * If not provided, the default clasp OAuth client is used.
 * @returns {OAuth2Client} An unauthorized OAuth2 client instance.
 */
export function getUnauthorizedOuth2Client(clientSecretPath?: string): OAuth2Client {
  if (clientSecretPath) {
    return createOauthClient(clientSecretPath);
  }
  return createDefaultOAuthClient();
}

/**
 * Create an authorized oauth2 client from saved credentials.
 * @param {CredentialStore} store - The credential store to load from.
 * @param {string} [userKey='default'] - The user key for the credentials.
 * @returns {Promise<OAuth2Client | undefined>} An authorized OAuth2 client if credentials
 * are found and valid, otherwise undefined. The client is configured to auto-refresh
 * tokens and save them back to the store.
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

/**
 * Options for the authorization process.
 * @property {boolean} [noLocalServer] - If true, uses a serverless flow (manual code copy-paste).
 * Otherwise, attempts to start a local server for the redirect.
 * @property {number} [redirectPort] - Specific port to use for the local redirect server.
 * @property {string[] | string} scopes - The OAuth scope(s) to request authorization for.
 * @property {OAuth2Client} oauth2Client - The OAuth2 client to be authorized.
 * @property {CredentialStore} store - The credential store for saving the obtained credentials.
 * @property {string} userKey - The user key under which to save the credentials.
 */
export type AuthorizationOptions = {
  noLocalServer?: boolean;
  redirectPort?: number;
  scopes: string[] | string;
  oauth2Client: OAuth2Client;
  store: CredentialStore;
  userKey: string;
};

/**
 * Initiates an OAuth 2.0 authorization flow to obtain user consent and credentials.
 * It selects between a local server flow or a serverless (manual) flow based on options.
 * @param {AuthorizationOptions} options - Configuration for the authorization flow.
 * @returns {Promise<OAuth2Client>} The authorized OAuth2 client.
 */
export async function authorize(options: AuthorizationOptions) {
  let flow: AuthorizationCodeFlow;
  if (options.noLocalServer) {
    debug('Starting auth with serverless flow');
    flow = new ServerlessAuthorizationCodeFlow(options.oauth2Client);
  } else {
    debug('Starting auth with local server flow');
    flow = new LocalServerAuthorizationCodeFlow(options.oauth2Client, options.redirectPort);
  }

  const client = await flow.authorize(options.scopes);
  await saveOauthClientCredentials(options.store, options.userKey, client);
  debug('Auth complete');
  return client;
}

/**
 * Saves the obtained OAuth2 client credentials to the provided credential store.
 * It also sets up an event listener on the client to save refreshed tokens.
 * @param {CredentialStore} store - The credential store.
 * @param {string} userKey - The user key for saving credentials.
 * @param {OAuth2Client} oauth2Client - The OAuth2 client whose credentials are to be saved.
 */
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

/**
 * Attempts to create an OAuth2Client using Google Application Default Credentials (ADC).
 * This is typically used in server environments where credentials can be automatically discovered.
 * @returns {Promise<OAuth2Client | undefined>} An OAuth2Client if ADC are available and valid,
 * otherwise undefined.
 */
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
