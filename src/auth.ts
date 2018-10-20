/**
 * Authentication with Google's APIs.
 */
import * as http from 'http';
import { AddressInfo } from 'net';
import * as url from 'url';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { OAuth2ClientOptions } from 'google-auth-library/build/src/auth/oauth2client';
import { discovery_v1, drive_v3, google, logging_v2, script_v1, serviceusage_v1 } from 'googleapis';
import { prompt } from 'inquirer';
import {
  ClaspToken,
  DOTFILE,
} from './dotfile';
import { ClaspCredentials } from './utils';
import {
  ERROR,
  LOG,
  URL,
  checkIfOnline,
  getOAuthSettings,
  getProjectId,
  hasOauthClientSettings,
  loadManifest,
  logError,
} from './utils';
import open = require('opn');
import readline = require('readline');

// Auth is complicated. Consider yourself warned.
// tslint:disable:max-line-length
// GLOBAL: clasp login will store this (~/.clasprc.json):
// {
//   "access_token": "ya29.GlsxBm9yMD8IxaVeb_PGFMa61JvQGaPAweBsB1klcQwwrztDkw7E99s_Y3LS5yfgHMLyE_XIm_f0oubwQE7JVh6cQni_2TqL-UqO7xmifp3CqhFBW81UIxPzAmfA",
//   "refresh_token": "1/k4rt_hgxbeGdaRag2TSVgnXgUrWcXwerPpvlzGG1peHVfzI58EZH0P25c7ykiRYd",
//   "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.webapp.deploy https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/logging.read https://www.googleapis.com/auth/script.deployments https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/cloud-platform",
//   "token_type": "Bearer",
//   "expiry_date": 1539130731398
// }
// LOCAL: clasp login will store this (./.clasprc.json):
// {
//   "token": {
//     "access_token": "ya29.flsxBm9yMD8rxaVeb_PGFMa61JvQGaPAweBsB1klcQwwrztDkw7E99s_Y3LS5yfgHMLyE_XIm_f0oubwQE7JVh6cQni_2TqL-UqO7xmifp3CqhFBW81UIxPzAmfA",
//     "refresh_token": "1/k4rw_hgxbeGdaRag2TSVgnXgUrWcXwerPpvlzGG1peHVfzI58EZH0P25c7ykiRYd",
//     "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.webapp.deploy https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/logging.read https://www.googleapis.com/auth/script.deployments https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/cloud-platform",
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
// tslint:enable:max-line-length
// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const oauth2ClientAuthUrlOpts = {
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
    'https://www.googleapis.com/auth/script.projects', // Apps Script management
    'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
    'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
    'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
    'https://www.googleapis.com/auth/logging.read', // StackDriver logs

    // Extra scope since service.management doesn't work alone
    'https://www.googleapis.com/auth/cloud-platform',
  ],
};
const globalOauth2ClientSettings: OAuth2ClientOptions = {
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
};
const globalOAuth2Client = new OAuth2Client(globalOauth2ClientSettings);
let localOAuth2Client: OAuth2Client; // Must be set up after authorize.

// *Global* Google API clients
export const script = google.script({ version: 'v1', auth: globalOAuth2Client }) as script_v1.Script;
export const logger = google.logging({ version: 'v2', auth: globalOAuth2Client }) as logging_v2.Logging;
export const drive = google.drive({ version: 'v3', auth: globalOAuth2Client }) as drive_v3.Drive;
export const discovery = google.discovery({ version: 'v1' }) as discovery_v1.Discovery;
export const serviceUsage = google.serviceusage({
  version: 'v1',
  auth: globalOAuth2Client,
}) as serviceusage_v1.Serviceusage;

/**
 * Gets the local OAuth client for the Google Apps Script API.
 * Only the Apps Script API needs to use local credential for the Execution API (script.run).
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 */
export async function getLocalScript(): Promise<script_v1.Script> {
  return google.script({ version: 'v1', auth: localOAuth2Client }) as script_v1.Script;
}

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] authorize additional OAuth scopes.
 */
export async function authorize(options: {
  useLocalhost: boolean,
  creds?: ClaspCredentials,
  scopes?: string[],
}) {
  const creds = options.creds;
  try {
    // Add custom scopes when authing.
    oauth2ClientAuthUrlOpts.scope = [...oauth2ClientAuthUrlOpts.scope, ...options.scopes || []];

    let oAuth2ClientOptions: OAuth2ClientOptions;
    if (options.creds) { // if we passed our own creds
      // Use local credentials
      console.log('Creds from this project:');
      console.log(URL.CREDS(options.creds.installed.project_id));
      console.log();
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

    // Grab a token from the credentials.
    const token = await (options.useLocalhost ?
      authorizeWithLocalhost(oAuth2ClientOptions) :
      authorizeWithoutLocalhost(oAuth2ClientOptions));
    console.log(LOG.AUTH_SUCCESSFUL + '\n');

    // Save the token and own creds together.
    let claspToken: ClaspToken;
    if (creds) {
      // Save local ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: {
          clientId: creds.installed.client_id,
          clientSecret: creds.installed.client_secret,
          redirectUri: creds.installed.redirect_uris[0],
        },
        isLocalCreds: true,
      };
      await DOTFILE.RC_LOCAL.write(claspToken);
    } else {
      // Save global ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: globalOauth2ClientSettings,
        isLocalCreds: true,
      };
      await DOTFILE.RC.write(claspToken);
    }
    console.log(LOG.SAVED_CREDS(!!creds));
  } catch (err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 */
export async function loadAPICredentials(): Promise<ClaspToken> {
  // Gets the OAuth settings. May be local or global.
  const rc: ClaspToken = await getOAuthSettings();
  await setOauthCredentials(rc);
  return rc;
}

/**
 * Requests authorization to manage Apps Script projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth
 * Used for local/global testing.
 */
async function authorizeWithLocalhost(oAuth2ClientOptions: OAuth2ClientOptions): Promise<Credentials> {
  // Wait until the server is listening, otherwise we don't have
  // the server port needed to set up the Oauth2Client.
  const server = await new Promise<http.Server>((resolve, _) => {
    const s = http.createServer();
    s.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port; // (Cast from <string | AddressInfo>)
  const client = new OAuth2Client({
    ...oAuth2ClientOptions,
    redirectUri: `http://localhost:${port}`,
  });
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
 * Requests authorization to manage Apps Script projects. Requires the user to
 * manually copy/paste the authorization code. No HTTP server is used.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth.
 */
async function authorizeWithoutLocalhost(oAuth2ClientOptions: OAuth2ClientOptions): Promise<Credentials> {
  const client = new OAuth2Client({
    ...oAuth2ClientOptions,
    redirectUri: REDIRECT_URI_OOB,
  });
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
 * Set global OAuth client credentails from rc, save new if access token refreshed.
 * @param {ClaspToken} rc OAuth client settings from rc file.
 */
async function setOauthCredentials(rc: ClaspToken) {
  /**
   * Refreshes the credentials and saves them.
   */
  async function refreshCredentials(oAuthClient: OAuth2Client) {
    const oldExpiry = oAuthClient.credentials.expiry_date as number || 0;
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
    await (rc.isLocalCreds ? DOTFILE.RC_LOCAL : DOTFILE.RC).write(rc);
  } catch (err) {
    logError(null, ERROR.ACCESS_TOKEN + err);
  }
}

/**
 * Compare global OAuth client scopes against manifest and prompt user to
 * authorize if new scopes found (local OAuth credentails only).
 * @param {ClaspToken} rc OAuth client settings from rc file.
 */
export async function checkOauthScopes(rc: ClaspToken) {
  try {
    await checkIfOnline();
    await setOauthCredentials(rc);
    const { scopes } = await globalOAuth2Client.getTokenInfo(
      globalOAuth2Client.credentials.access_token as string);
    const { oauthScopes } = await loadManifest();
    const newScopes = oauthScopes &&
      oauthScopes.length ? (oauthScopes as string[]).filter(x => !scopes.includes(x)) : [];
    if (!newScopes.length) return;
    console.log('New authoization scopes detected in manifest:\n', newScopes);
    await prompt([{
      type: 'confirm',
      name: 'doAuth',
      message: 'Authorize new scopes?',
    }, {
      type: 'confirm',
      name: 'localhost',
      message: 'Use localhost?',
      when: (answers: any) => {
        return answers.doAuth;
      },
    }]).then(async (answers: any) => {
      if (answers.doAuth) {
        if (!rc.isLocalCreds) return logError(null, ERROR.NO_LOCAL_CREDENTIALS);
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