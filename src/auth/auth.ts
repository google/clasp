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
 * @fileoverview Handles authentication and OAuth2 client management for clasp.
 * It provides functions to initialize authentication, retrieve user information,
 * authorize access, and manage OAuth2 client credentials.
 */

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

/**
 * Options for initializing authentication.
 */
type InitOptions = {
  /** Path to the authentication file. Defaults to ~/.clasprc.json. */
  authFilePath?: string;
  /** Identifier for the user's credentials. Defaults to 'default'. */
  userKey?: string;
  /** Whether to use Application Default Credentials. */
  useApplicationDefaultCredentials?: boolean;
};

/**
 * Holds authentication information.
 */
export type AuthInfo = {
  /** The OAuth2Client instance, if authenticated. */
  credentials?: OAuth2Client;
  /** The credential store used to load/save credentials. */
  credentialStore?: CredentialStore;
  /** The user key associated with the credentials. */
  user: string;
};

/**
 * Initializes authentication by loading credentials from the specified path or using Application Default Credentials.
 * @param options Options for initializing authentication.
 * @returns A promise that resolves with the authentication information.
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
 * Fetches user information using the provided OAuth2Client.
 * @param credentials The OAuth2Client instance.
 * @returns A promise that resolves with the user's email and ID, or undefined if an error occurs or no data is returned.
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
 * Creates an unauthorized OAuth2 client from a client secret file or returns a default client.
 * @param clientSecretPath Optional path to the client secret file.
 * @returns An OAuth2Client instance.
 */
export function getUnauthorizedOuth2Client(clientSecretPath?: string): OAuth2Client {
  if (clientSecretPath) {
    return createOauthClient(clientSecretPath);
  }
  return createDefaultOAuthClient();
}

/**
 * Creates an authorized OAuth2 client from saved credentials.
 * @param store The credential store to load credentials from.
 * @param userKey Optional user key to identify the credentials. Defaults to 'default'.
 * @returns A promise that resolves with an authorized OAuth2Client instance, or undefined if no saved credentials are found.
 */
export async function getAuthorizedOAuth2Client(
  store: CredentialStore,
  userKey?: string,
): Promise<OAuth2Client | undefined> {
  // Default to 'default' user if no userKey is provided.
  const currentUserKey = userKey ?? 'default';

  debug('Loading credentials for user %s', currentUserKey);

  const savedCredentials = await store.load(currentUserKey);
  if (!savedCredentials) {
    debug('No saved credentials found.');
    return undefined;
  }

  const client = new GoogleAuth().fromJSON(savedCredentials) as OAuth2Client;
  client.setCredentials(savedCredentials);
  // Set up a listener for token refresh events to save the new tokens.
  client.on('tokens', async tokens => {
    debug('Saving refreshed token for user %s', currentUserKey);
    const refreshedCredentials = {
      ...savedCredentials,
      expiry_date: tokens.expiry_date,
      access_token: tokens.access_token,
      id_token: tokens.id_token, // Corrected: should be tokens.id_token
    };
    await store.save(currentUserKey, refreshedCredentials);
  });
  return client;
}

/**
 * Options for the authorization process.
 */
export type AuthorizationOptions = {
  noLocalServer?: boolean;
  redirectPort?: number;
  scopes: string[] | string;
  oauth2Client: OAuth2Client;
  store: CredentialStore;
  /** User key to save the credentials under. */
  userKey: string;
};

/**
 * Requests authorization from the user for the given scopes.
 * It uses either a local server flow or a serverless flow based on the options.
 * @param options Options for the authorization process.
 * @returns A promise that resolves with the authorized OAuth2Client.
 */
export async function authorize(options: AuthorizationOptions): Promise<OAuth2Client> {
  let flow: AuthorizationCodeFlow;
  if (options.noLocalServer) {
    debug('Starting auth with serverless flow');
    flow = new ServerlessAuthorizationCodeFlow(options.oauth2Client);
  } else {
    debug('Starting auth with local server flow');
    // Pass redirectPort to LocalServerAuthorizationCodeFlow if needed, or handle it within the flow.
    flow = new LocalServerAuthorizationCodeFlow(options.oauth2Client, options.redirectPort);
  }

  const client = await flow.authorize(options.scopes);
  await saveOauthClientCredentials(options.store, options.userKey, client);
  debug('Auth complete');
  return client;
}

/**
 * Saves the OAuth2 client credentials to the provided store.
 * Also sets up an event listener to save refreshed tokens.
 * @param store The credential store.
 * @param userKey The user key to save credentials under.
 * @param oauth2Client The OAuth2Client whose credentials are to be saved.
 */
async function saveOauthClientCredentials(store: CredentialStore, userKey: string, oauth2Client: OAuth2Client) {
  // Extract relevant credentials for storage.
  const savedCredentials = {
    client_id: oauth2Client._clientId,
    client_secret: oauth2Client._clientSecret,
    type: 'authorized_user', // Standard type for user credentials.
    refresh_token: oauth2Client.credentials.refresh_token ?? undefined,
    access_token: oauth2Client.credentials.access_token ?? undefined,
    // expiry_date is handled by the 'tokens' event.
  };

  // Listen for token refresh events to update stored credentials.
  oauth2Client.on('tokens', async tokens => {
    // Combine existing client info with new token data.
    const refreshedCredentials = {
      ...savedCredentials, // Retain client_id, client_secret, type
      refresh_token: tokens.refresh_token ?? savedCredentials.refresh_token, // Update refresh token if a new one is provided
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      expiry_date: tokens.expiry_date,
    };
    debug('Saving refreshed credentials for user %s', userKey);
    await store.save(userKey, refreshedCredentials);
  });

  // Perform initial save of the credentials.
  debug('Saving initial credentials for user %s', userKey);
  await store.save(userKey, savedCredentials);
}

/**
 * Creates an unauthorized OAuth2 client using credentials from a specified file.
 * @param clientSecretPath Path to the client secret JSON file.
 * @returns An OAuth2Client instance.
 * @throws Error if the clientSecretPath is invalid, the file cannot be read,
 * or the file content is malformed (e.g., missing redirect URIs).
 */
function createOauthClient(clientSecretPath: string): OAuth2Client {
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
    // Ensure a localhost redirect URI is present for CLI flows.
    throw new Error('No localhost redirect URL found in client secrets file.');
  }
  // Create an oAuth client to authorize the API call.
  const client = new OAuth2Client({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri: redirectUrl,
  });
  debug('Created built-in oauth client, id: %s', client._clientId);
  return client;
}

/**
 * Creates an unauthorized OAuth2 client using the default clasp client ID and secret.
 * This is used when a specific client secret file is not provided.
 * @returns An OAuth2Client instance configured with default credentials.
 */
function createDefaultOAuthClient(): OAuth2Client {
  // Default client credentials for clasp.
  const client = new OAuth2Client({
    clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
    clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
    redirectUri: 'http://localhost',
  });
  debug('Created built-in oauth client, id: %s', client._clientId);
  return client;
}

/**
 * Creates an OAuth2Client using Application Default Credentials (ADC).
 * ADC are typically used in server environments where a service account can be configured.
 * @returns A promise that resolves with an OAuth2Client if ADC are found and valid, otherwise undefined.
 */
export async function createApplicationDefaultCredentials(): Promise<OAuth2Client | undefined> {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
      'https://www.googleapis.com/auth/script.projects', // Apps Script management
      'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
      'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
      'https://www.googleapis.com/auth/drive.file', // Create Drive files
      'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
      'https://www.googleapis.com/auth/logging.read', // StackDriver logs
      'https://www.googleapis.com/auth/userinfo.email', // User email address
      'https://www.googleapis.com/auth/userinfo.profile', // User profile information
      'https://www.googleapis.com/auth/cloud-platform', // General Cloud Platform access
    ],
  });

  try {
    const client = await auth.getClient();
    // Ensure the client is an OAuth2Client, as expected for user-centric flows,
    // though ADC often results in other client types like Compute or Impersonated.
    // This check might need adjustment based on how ADC is intended to be used in clasp.
    // TODO: Remove this check after https://github.com/googleapis/google-auth-library-nodejs/issues/1677 fixed
    if (client instanceof OAuth2Client) {
      debug('Created service account credentials using ADC, client ID: %s', client._clientId);
      return client;
    }
    debug('Application Default Credentials did not result in an OAuth2Client. Type: %s', client.constructor.name);
    // Depending on clasp's requirements, might need to handle other ADC client types
    // or explicitly state that only OAuth2Client-compatible ADC is supported.
    return undefined;
  } catch (error) {
    debug('Failed to create Application Default Credentials: %O', error);
    // Gracefully handle cases where ADC are not configured or fail to load.
    return undefined;
  }
}
