import * as fs from 'fs';
/**
 * Authentication with Google's APIs.
 */
import * as http from 'http';
import { AddressInfo } from 'net';
import * as url from 'url';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { Discovery } from 'googleapis/build/src/apis/discovery/v1';
import { Drive } from 'googleapis/build/src/apis/drive/v3';
import { Logging } from 'googleapis/build/src/apis/logging/v2';
import { Script } from 'googleapis/build/src/apis/script/v1';
import {
  checkIfOnline,
  ClaspSettings,
  DOTFILE,
  ERROR,
  getOAuthSettings,
  hasDefaultOathSettings,
  hasLocalOathSettings,
  isLocalCreds,
  LOG,
  logError,
} from './utils';
import open = require('opn');
import readline = require('readline');

// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const oauth2ClientAuthUrlOpts = {
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/script.webapp.deploy',
    'https://www.googleapis.com/auth/cloud-platform.read-only',
    'https://www.googleapis.com/auth/logging.read',
  ],
};
const oauth2ClientSettings = {
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
};

const globalOauth2Client = new OAuth2Client(oauth2ClientSettings);

// *Global* Google API clients
export const script = google.script({version: 'v1', auth: globalOauth2Client}) as Script;
export const logger = google.logging({version: 'v2', auth: globalOauth2Client}) as Logging;
export const drive = google.drive({version: 'v3', auth: globalOauth2Client}) as Drive;
export const discovery = google.discovery({version: 'v1'}) as Discovery;

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 * @param {boolean} ownCreds save local rc file.
 * @param {Array<string>} [scopes=[]] authorize additional OAuth scopes.
 */
export async function authorize(options: {
  useLocalhost: boolean,
  ownCreds: boolean,
  scopes?: string[],
}) {
  try {
    oauth2ClientAuthUrlOpts.scope = [...oauth2ClientAuthUrlOpts.scope, ...options.scopes || []];
    const token = await (options.useLocalhost ? authorizeWithLocalhost() : authorizeWithoutLocalhost());
    console.log(LOG.AUTH_SUCCESSFUL);
    await (options.ownCreds ?
      DOTFILE.RC_LOCAL.write({token, oauth2ClientSettings}) :
      DOTFILE.RC.write(token));
    console.log(options.ownCreds ? LOG.SAVED_LOCAL_CREDS : LOG.SAVED_CREDS);
    globalOauth2Client.setCredentials(token);
  } catch(err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 */
export async function loadAPICredentials(): Promise<ClaspSettings> {
  const rc = await getOAuthSettings();
  await setOauthCredentials(rc);
  return rc;
}

/**
 * Requests authorization to manage Apps Script projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 */
async function authorizeWithLocalhost() {
  // Wait until the server is listening, otherwise we don't have
  // the server port needed to set up the Oauth2Client.
  const server = await new Promise<http.Server>((resolve, _) => {
    const s = http.createServer();
    s.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port; // (Cast from <string | AddressInfo>)
  const client = new OAuth2Client({
    ...oauth2ClientSettings,
    redirectUri: `http://localhost:${port}`});
  const authCode = await new Promise<string>((res, rej) => {
    server.on('request', (req: http.ServerRequest, resp: http.ServerResponse) => {
      const urlParts = url.parse(req.url || '', true);
      if (urlParts.query.code) {
        res(urlParts.query.code as string);
      } else {
        rej(urlParts.query.error);
      }
      resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
    });
    const authUrl = client.generateAuthUrl(oauth2ClientAuthUrlOpts);
    console.log(LOG.AUTHORIZE(authUrl));
    open(authUrl);
  });
  server.close();
  return (await client.getToken(authCode)).tokens;
}

/**
 * Requests authorization to manage Apps Script projects. Requires the
 * user to manually copy/paste the authorization code. No HTTP server is
 * used.
 */
async function authorizeWithoutLocalhost() {
  const client = new OAuth2Client({...oauth2ClientSettings, redirectUri: REDIRECT_URI_OOB});
  const authUrl = client.generateAuthUrl(oauth2ClientAuthUrlOpts);
  console.log(LOG.AUTHORIZE(authUrl));
  const authCode = await new Promise<string>((res, rej) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(LOG.AUTH_CODE, (code: string) => {
      if (code && code.length) {
        res(code);
      } else {
        rej('No authorization code entered.');
      }
      rl.close();
    });
  });
  return (await client.getToken(authCode)).tokens;
}

/**
 * Logs the user in. Saves the client credentials to an rc file.
 * @param {object} options the localhost and creds options from commander.
 * @param {boolean} options.localhost authorize without http server.
 * @param {string} options.creds location of credentials file.
 */
export async function login(options: { localhost: boolean, creds: string }) {
  const hasLoginLocal = options.creds && hasLocalOathSettings();
  const hasLoginDefault = !options.creds && hasDefaultOathSettings();
  if (hasLoginLocal || hasLoginDefault) {
    logError(null, ERROR.LOGGED_IN);
  }
  await checkIfOnline();
  let ownCreds = false;
  try {
    const credentials = JSON.parse(fs.readFileSync(options.creds, 'utf8'));
    const isValidCreds = credentials &&
      credentials.installed &&
      credentials.installed.client_id &&
      credentials.installed.client_secret;
    if (isValidCreds) {
      oauth2ClientSettings.clientId = credentials.installed.client_id;
      oauth2ClientSettings.clientSecret = credentials.installed.client_secret;
      ownCreds = true;
      console.log(LOG.CREDENTIALS_FOUND);
    } else {
      logError(null, ERROR.BAD_CREDENTIALS_FILE);
    }
  } catch(err) {
    if (err.code === 'ENOENT') {
      logError(null, ERROR.NO_CREDENTIALS);
    }
    console.log(LOG.DEFAULT_CREDENTIALS);
  }
  await authorize({useLocalhost: options.localhost, ownCreds});
  process.exit(0); // gracefully exit after successful login
}

/**
 * Set global OAuth client credentails from rc, save new if access token refreshed.
 * @param {ClaspSettings} rc OAuth client settings from rc file.
 */
async function setOauthCredentials(rc: ClaspSettings) {
  try {
    await checkIfOnline();
    if (isLocalCreds(rc)) {
      // set global OAuth client settings for authorize
      oauth2ClientSettings.clientId = rc.oauth2ClientSettings.clientId;
      oauth2ClientSettings.clientSecret = rc.oauth2ClientSettings.clientSecret;
      // hack to ensure API clients ALREADY initialized with default
      // global OAuth client use local clientId & clientSecret
      globalOauth2Client._clientId = rc.oauth2ClientSettings.clientId;
      globalOauth2Client._clientSecret = rc.oauth2ClientSettings.clientSecret;
      globalOauth2Client.setCredentials(rc.token);
    } else {
      globalOauth2Client.setCredentials(rc);
    }

    // TODO optional? refresh
    const oldExpiry = globalOauth2Client.credentials.expiry_date as number || 0;
    await globalOauth2Client.getAccessToken(); // refreshes expiry date if required
    if (globalOauth2Client.credentials.expiry_date === oldExpiry) return;
    if (isLocalCreds(rc)) {
      rc.token = globalOauth2Client.credentials;
      await DOTFILE.RC_LOCAL.write(rc);
    } else {
      rc = globalOauth2Client.credentials;
      await DOTFILE.RC.write(rc);
    }
  } catch (err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}
