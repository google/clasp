/**
 * Authentication with Google's APIs.
 */
import * as http from 'http';
import { AddressInfo } from 'net';
import * as url from 'url';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { Drive } from 'googleapis/build/src/apis/drive/v3';
import { Logging } from 'googleapis/build/src/apis/logging/v2';
import { Script } from 'googleapis/build/src/apis/script/v1';
import { ClaspSettings, DOTFILE, ERROR, LOG, checkIfOnline, logError } from './utils';
import open = require('opn');
import readline = require('readline');
import { Discovery } from 'googleapis/build/src/apis/discovery/v1';
import * as fs from 'fs';

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
const oauth2Client = new OAuth2Client(oauth2ClientSettings);

// Google API clients
export const script = google.script({version: 'v1', auth: oauth2Client}) as Script;
export const logger = google.logging({version: 'v2', auth: oauth2Client}) as Logging;
export const drive = google.drive({version: 'v3', auth: oauth2Client}) as Drive;
export const discovery = google.discovery({version: 'v1'}) as Discovery;

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 * @param {string} creds location of credentials file.
 */
async function authorize(useLocalhost: boolean, creds: string) {
  let ownCreds = false;
  try {
    const credentials = JSON.parse(fs.readFileSync(creds, 'utf8'));
    if (credentials && credentials.installed && credentials.installed.client_id
      && credentials.installed.client_secret) {
        oauth2ClientSettings.clientId = credentials.installed.client_id;
        oauth2ClientSettings.clientSecret = credentials.installed.client_secret;
        ownCreds = true;
        console.log(LOG.CREDENTIALS_FOUND);
    } else {
      logError(null, ERROR.BAD_CREDENTIALS_FILE);
    }
  } catch(err) {
    if (err.code === 'ENOENT') {
      logError(null, ERROR.CREDENTIALS_DNE);
    }
    console.log(LOG.DEFAULT_CREDENTIALS);
  }
  try {
    const token = await (useLocalhost ? authorizeWithLocalhost() : authorizeWithoutLocalhost());
    await (ownCreds ? DOTFILE.RC_LOCAL.write(token) : DOTFILE.RC.write(token));
    console.log(LOG.AUTH_SUCCESSFUL);
    process.exit(0); // gracefully exit after successful login
  } catch(err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 */
export async function loadAPICredentials() {
  return DOTFILE.RC_LOCAL.read().then((rc: ClaspSettings) => {
    oauth2Client.setCredentials(rc);
  }).catch((err: any) => {
    return DOTFILE.RC.read().then((rc: ClaspSettings) => {
      oauth2Client.setCredentials(rc);
    }).catch((err: any) => {
      logError(err, 'Could not read API credentials. Error:');
    });
  });
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
export function login(options: { localhost: boolean, creds: string}) {
  DOTFILE.RC.read().then((rc: ClaspSettings) => {
    console.warn(ERROR.LOGGED_IN);
  }).catch(async (err: string) => {
    DOTFILE.RC_LOCAL.read().then((rc: ClaspSettings) => {
      console.warn(ERROR.LOGGED_IN);
    }).catch(async (err: string) => {
      await checkIfOnline();
      authorize(options.localhost, options.creds);
    });
  });
}