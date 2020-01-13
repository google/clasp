import http from 'http';
import { AddressInfo } from 'net';
import readline from 'readline';
import url from 'url';
/**
 * Authentication with Google's APIs.
 */
import { Credentials, GenerateAuthUrlOpts, OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import { google, script_v1 } from 'googleapis';
import open from 'open';
import { ClaspToken, DOTFILE, Dotfile } from './dotfile';
import { oauthScopesPrompt } from './inquirer';
import { readManifest } from './manifest';
import { ClaspCredentials, ERROR, LOG, checkIfOnline, getOAuthSettings, logError } from './utils';

// Auth is complicated. Consider yourself warned.
// tslint:disable:max-line-length
// GLOBAL: clasp login will store this (~/.clasprc.json):
// {
//   "access_token": "XXX",
//   "refresh_token": "1/k4rt_hgxbeGdaRag2TSVgnXgUrWcXwerPpvlzGG1peHVfzI58EZH0P25c7ykiRYd",
//   "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script ...",
//   "token_type": "Bearer",
//   "expiry_date": 1539130731398
// }
// LOCAL: clasp login will store this (./.clasprc.json):
// {
//   "token": {
//     "access_token": "XXX",
//     "refresh_token": "1/k4rw_hgxbeGdaRag2TSVgnXgUrWcXwerPpvlzGG1peHVfzI58EZH0P25c7ykiRYd",
//     "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script ...",
//     "token_type": "Bearer",
//     "expiry_date": 1539130731398
//   },
//   // Settings
//   "oauth2ClientSettings": {
//     "clientId": "807925367021-infvb16rd7lasqi22q2npeahkeodfrq5.apps.googleusercontent.com",
//     "clientSecret": "9dbdeOCRHUyriewCoDrLHtPg",
//     "redirectUri": "http://localhost"
//   },
//   "isLocalCreds": true
// }
// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const globalOauth2ClientSettings: OAuth2ClientOptions = {
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
};
const globalOAuth2Client = new OAuth2Client(globalOauth2ClientSettings);
let localOAuth2Client: OAuth2Client; // Must be set up after authorize.

// *Global* Google API clients
export const script = google.script({ version: 'v1', auth: globalOAuth2Client });
export const logger = google.logging({ version: 'v2', auth: globalOAuth2Client });
export const drive = google.drive({ version: 'v3', auth: globalOAuth2Client });
export const discovery = google.discovery({ version: 'v1' });
export const serviceUsage = google.serviceusage({
  version: 'v1',
  auth: globalOAuth2Client,
});

/**
 * Gets the local OAuth client for the Google Apps Script API.
 * Only the Apps Script API needs to use local credential for the Execution API (script.run).
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 */
export async function getLocalScript(): Promise<script_v1.Script> {
  return google.script({ version: 'v1', auth: localOAuth2Client });
}

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] List of OAuth scopes to authorize.
 */
export async function authorize(options: {
  useLocalhost: boolean;
  creds?: ClaspCredentials;
  scopes: string[]; // only used with custom creds.
}) {
  try {
    // Set OAuth2 Client Options
    let oAuth2ClientOptions: OAuth2ClientOptions;
    if (options.creds) {
      // if we passed our own creds
      // Use local credentials
      console.log(LOG.CREDS_FROM_PROJECT(options.creds.installed.project_id));
      const localOAuth2ClientOptions: OAuth2ClientOptions = {
        clientId: options.creds.installed.client_id,
        clientSecret: options.creds.installed.client_secret,
        redirectUri: options.creds.installed.redirect_uris[0],
      };
      oAuth2ClientOptions = localOAuth2ClientOptions;
    } else {
      // Use global credentials
      const globalOauth2ClientOptions: OAuth2ClientOptions = {
        clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
        clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
        redirectUri: 'http://localhost',
      };
      oAuth2ClientOptions = globalOauth2ClientOptions;
    }

    // Set scopes
    let scope = (options.creds) ?
      // Set scopes to custom scopes
      options.scopes : [
        // Default to clasp scopes
        'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
        'https://www.googleapis.com/auth/script.projects', // Apps Script management
        'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
        'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
        'https://www.googleapis.com/auth/drive.file', // Create Drive files
        'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
        'https://www.googleapis.com/auth/logging.read', // StackDriver logs
        'https://www.googleapis.com/auth/userinfo.email', // User email address
        'https://www.googleapis.com/auth/userinfo.profile',

        // Extra scope since service.management doesn't work alone
        'https://www.googleapis.com/auth/cloud-platform',
      ];
    if (options.creds && scope.length === 0) {
      scope = [
        // Default to clasp scopes
        'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
        'https://www.googleapis.com/auth/script.projects', // Apps Script management
        'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
        'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
        'https://www.googleapis.com/auth/drive.file', // Create Drive files
        'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
        'https://www.googleapis.com/auth/logging.read', // StackDriver logs
        'https://www.googleapis.com/auth/userinfo.email', // User email address
        'https://www.googleapis.com/auth/userinfo.profile',

        // Extra scope since service.management doesn't work alone
        'https://www.googleapis.com/auth/cloud-platform',
      ];
      // TODO formal error
      // logError(null, 'You need to specify scopes in the manifest.' +
      // 'View appsscript.json. Add a list of scopes in "oauthScopes"' +
      // 'Tip:' +
      // '1. clasp open' +
      // '2. File > Project Properties > Scopes');
    }
    const oAuth2ClientAuthUrlOpts: GenerateAuthUrlOpts = {
      access_type: 'offline',
      scope,
    };

    // Grab a token from the credentials.
    const token = await (options.useLocalhost
      ? authorizeWithLocalhost(oAuth2ClientOptions, oAuth2ClientAuthUrlOpts)
      : authorizeWithoutLocalhost(oAuth2ClientOptions, oAuth2ClientAuthUrlOpts));
    console.log(LOG.AUTH_SUCCESSFUL + '\n');

    // Save the token and own creds together.
    let claspToken: ClaspToken;
    let dotfile: Dotfile;
    if (options.creds) {
      dotfile = DOTFILE.RC_LOCAL();
      // Save local ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: {
          clientId: options.creds.installed.client_id,
          clientSecret: options.creds.installed.client_secret,
          redirectUri: options.creds.installed.redirect_uris[0],
        },
        isLocalCreds: true,
      };
    } else {
      dotfile = DOTFILE.RC;
      // Save global ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: globalOauth2ClientSettings,
        isLocalCreds: false,
      };
    }
    await dotfile.write(claspToken);
    console.log(LOG.SAVED_CREDS(!!options.creds));
  } catch (err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

export async function getLoggedInEmail() {
  await loadAPICredentials();
  try {
    const response = await google.oauth2('v2').userinfo.get({
      auth: globalOAuth2Client,
    });
    return response.data.email;
  } catch (e) {
    return undefined;
  }
}

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 */
export async function loadAPICredentials(local = false): Promise<ClaspToken> {
  // Gets the OAuth settings. May be local or global.
  const rc: ClaspToken = await getOAuthSettings(local);
  await setOauthClientCredentials(rc);
  return rc;
}

/**
 * Requests authorization to manage Apps Script projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth
 * @param {GenerateAuthUrlOpts} oAuth2ClientAuthUrlOpts Auth URL options
 * Used for local/global testing.
 */
async function authorizeWithLocalhost(
  oAuth2ClientOptions: OAuth2ClientOptions,
  oAuth2ClientAuthUrlOpts: GenerateAuthUrlOpts): Promise<Credentials> {
  // Wait until the server is listening, otherwise we don't have
  // the server port needed to set up the Oauth2Client.
  const server = await new Promise<http.Server>((resolve, _) => {
    const s = http.createServer();
    s.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const client = new OAuth2Client({
    ...oAuth2ClientOptions,
    redirectUri: `http://localhost:${port}`,
  });
  // TODO Add spinner
  const authCode = await new Promise<string>((res, rej) => {
    server.on('request', (req: http.IncomingMessage, resp: http.ServerResponse) => {
      const urlParts = url.parse(req.url || '', true);
      if (urlParts.query.code) {
        res(urlParts.query.code as string);
      } else {
        rej(urlParts.query.error);
      }
      resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
    });
    const authUrl = client.generateAuthUrl(oAuth2ClientAuthUrlOpts);
    console.log(LOG.AUTHORIZE(authUrl));
    if (process.platform === "win32") throw new Error(authUrl);
    open(authUrl);
  });
  server.close();
  return (await client.getToken(authCode)).tokens;
}

/**
 * Requests authorization to manage Apps Script projects. Requires the user to
 * manually copy/paste the authorization code. No HTTP server is used.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth.
 * @param {GenerateAuthUrlOpts} oAuth2ClientAuthUrlOpts Auth URL options
 */
async function authorizeWithoutLocalhost(
  oAuth2ClientOptions: OAuth2ClientOptions,
  oAuth2ClientAuthUrlOpts: GenerateAuthUrlOpts): Promise<Credentials> {
  const client = new OAuth2Client({
    ...oAuth2ClientOptions,
    redirectUri: REDIRECT_URI_OOB,
  });
  const authUrl = client.generateAuthUrl(oAuth2ClientAuthUrlOpts);
  console.log(LOG.AUTHORIZE(authUrl));
  // TODO Add spinner
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
 * Set OAuth client credentails from rc.
 * Can be global or local.
 * Saves new credentials if access token refreshed.
 * @param {ClaspToken} rc OAuth client settings from rc file.
 */
async function setOauthClientCredentials(rc: ClaspToken) {
  /**
   * Refreshes the credentials and saves them.
   */
  async function refreshCredentials(oAuthClient: OAuth2Client) {
    const oldExpiry = (oAuthClient.credentials.expiry_date as number) || 0;
    await oAuthClient.getAccessToken(); // refreshes expiry date if required
    if (oAuthClient.credentials.expiry_date === oldExpiry) return;
    rc.token = oAuthClient.credentials;
  }

  // Set credentials and refresh them.
  try {
    await checkIfOnline();
    if (rc.isLocalCreds) {
      localOAuth2Client = new OAuth2Client({
        clientId: rc.oauth2ClientSettings.clientId,
        clientSecret: rc.oauth2ClientSettings.clientSecret,
        redirectUri: rc.oauth2ClientSettings.redirectUri,
      });
      localOAuth2Client.setCredentials(rc.token);
      await refreshCredentials(localOAuth2Client);
    }
    // Always use the global credentials too for non-run functions.
    globalOAuth2Client.setCredentials(rc.token);
    await refreshCredentials(globalOAuth2Client);

    // Save the credentials.
    await (rc.isLocalCreds ? DOTFILE.RC_LOCAL() : DOTFILE.RC).write(rc);
  } catch (err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

/**
 * Compare global OAuth client scopes against manifest and prompt user to
 * authorize if new scopes found (local OAuth credentails only).
 * @param {ClaspToken} rc OAuth client settings from rc file.
 */
// TODO: currently unused. Check relevancy
export async function checkOauthScopes(rc: ClaspToken) {
  try {
    await checkIfOnline();
    await setOauthClientCredentials(rc);
    const { scopes } = await globalOAuth2Client.getTokenInfo(globalOAuth2Client.credentials
      .access_token as string);
    const { oauthScopes } = await readManifest();
    const newScopes =
      oauthScopes && oauthScopes.length ? (oauthScopes).filter(x => !scopes.includes(x)) : [];
    if (!newScopes.length) return;
    console.log('New authorization scopes detected in manifest:\n', newScopes);

    await oauthScopesPrompt()
    .then(async (answers) => {
      if (answers.doAuth) {
        if (!rc.isLocalCreds) logError(null, ERROR.NO_LOCAL_CREDENTIALS);
        await authorize({
          useLocalhost: answers.localhost,
          scopes: newScopes,
        });
      }
    });
  } catch (err) {
    logError(null, ERROR.BAD_REQUEST(err.message));
  }
}
