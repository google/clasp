import {OAuth2Client} from 'google-auth-library';
import {google, script_v1 as scriptV1} from 'googleapis';
import {createServer} from 'http';
import open from 'open';
import readline from 'readline';
import enableDestroy from 'server-destroy';
import type {Credentials, GenerateAuthUrlOpts, OAuth2ClientOptions} from 'google-auth-library';
import type {IncomingMessage, Server, ServerResponse} from 'http';
import type {AddressInfo} from 'net';
import type {ReadonlyDeep} from 'type-fest';

import {ClaspError} from './clasp-error.js';
import {DOTFILE} from './dotfile.js';
import {ERROR, LOG} from './messages.js';
import {getOAuthSettings} from './utils.js';
import type {ClaspToken} from './dotfile';
import type {ClaspCredentials} from './utils';

/**
 * Authentication with Google's APIs.
 */
// Auth is complicated. Consider yourself warned.
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

export const discovery = google.discovery({version: 'v1'});
export const drive = google.drive({version: 'v3', auth: globalOAuth2Client});
export const logger = google.logging({version: 'v2', auth: globalOAuth2Client});
export const script = google.script({version: 'v1', auth: globalOAuth2Client});
export const serviceUsage = google.serviceusage({version: 'v1', auth: globalOAuth2Client});
/**
 * Gets the local OAuth client for the Google Apps Script API.
 * Only the Apps Script API needs to use local credential for the Execution API (script.run).
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 */
export const getLocalScript = async (): Promise<scriptV1.Script> =>
  google.script({version: 'v1', auth: localOAuth2Client});

export const scopeWebAppDeploy = 'https://www.googleapis.com/auth/script.webapp.deploy'; // Scope needed for script.run
export const defaultScopes = [
  // Default to clasp scopes
  'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
  'https://www.googleapis.com/auth/script.projects', // Apps Script management
  scopeWebAppDeploy, // Apps Script Web Apps
  'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
  'https://www.googleapis.com/auth/drive.file', // Create Drive files
  'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
  'https://www.googleapis.com/auth/logging.read', // StackDriver logs
  'https://www.googleapis.com/auth/userinfo.email', // User email address
  'https://www.googleapis.com/auth/userinfo.profile',

  // Extra scope since service.management doesn't work alone
  'https://www.googleapis.com/auth/cloud-platform',
];

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] List of OAuth scopes to authorize.
 */
export const authorize = async (options: {
  readonly creds?: Readonly<ClaspCredentials>;
  readonly scopes: readonly string[]; // Only used with custom creds.
  readonly useLocalhost: boolean;
}) => {
  try {
    // Set OAuth2 Client Options
    let oAuth2ClientOptions: OAuth2ClientOptions;
    if (options.creds) {
      // If we passed our own creds
      // Use local credentials
      const {
        client_id: clientId,
        client_secret: clientSecret,
        project_id,
        redirect_uris: redirectUris,
      } = options.creds.installed;
      console.log(LOG.CREDS_FROM_PROJECT(project_id));
      oAuth2ClientOptions = {clientId, clientSecret, redirectUri: redirectUris[0]};
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
    let scope = (
      options.creds
        ? // Set scopes to custom scopes
          options.scopes
        : defaultScopes
    ) as string[];

    if (options.creds && scope.length === 0) {
      scope = defaultScopes;
      // TODO formal error
      // throw new ClaspError('You need to specify scopes in the manifest.' +
      // 'View appsscript.json. Add a list of scopes in "oauthScopes"' +
      // 'Tip:' +
      // '1. clasp open' +
      // '2. File > Project Properties > Scopes');
    }

    const oAuth2ClientAuthUrlOptions: GenerateAuthUrlOpts = {access_type: 'offline', scope};

    // Grab a token from the credentials.
    const token = await (options.useLocalhost ? authorizeWithLocalhost : authorizeWithoutLocalhost)(
      oAuth2ClientOptions,
      oAuth2ClientAuthUrlOptions
    );
    console.log(`${LOG.AUTH_SUCCESSFUL}\n`);

    // Save the token and own creds together.
    let claspToken: ClaspToken;
    if (options.creds) {
      const {client_id: clientId, client_secret: clientSecret, redirect_uris: redirectUri} = options.creds.installed;
      // Save local ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: {clientId, clientSecret, redirectUri: redirectUri[0]},
        isLocalCreds: true,
      };
    } else {
      // Save global ClaspCredentials.
      claspToken = {
        token,
        oauth2ClientSettings: globalOauth2ClientSettings,
        isLocalCreds: false,
      };
    }
    await DOTFILE.AUTH(claspToken.isLocalCreds).write(claspToken);
    console.log(LOG.SAVED_CREDS(Boolean(options.creds)));
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(`${ERROR.ACCESS_TOKEN}${error}`);
  }
};

export const getLoggedInEmail = async () => {
  await loadAPICredentials();
  try {
    return (await google.oauth2('v2').userinfo.get({auth: globalOAuth2Client})).data.email;
  } catch {
    return;
  }
};

/**
 * Loads the Apps Script API credentials for the CLI.
 *
 * Required before every API call.
 */
export const loadAPICredentials = async (local = false): Promise<ClaspToken> => {
  // Gets the OAuth settings. May be local or global.
  const rc: ClaspToken = await getOAuthSettings(local);
  await setOauthClientCredentials(rc);
  return rc;
};

/**
 * Requests authorization to manage Apps Script projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth
 * @param {GenerateAuthUrlOpts} oAuth2ClientAuthUrlOptions Auth URL options
 * Used for local/global testing.
 */
const authorizeWithLocalhost = async (
  oAuth2ClientOptions: Readonly<OAuth2ClientOptions>,
  oAuth2ClientAuthUrlOptions: Readonly<GenerateAuthUrlOpts>
): Promise<Credentials> => {
  // Wait until the server is listening, otherwise we don't have
  // the server port needed to set up the Oauth2Client.
  const server = await new Promise<Server>(resolve => {
    const s = createServer();
    enableDestroy(s);
    s.listen(0, () => resolve(s));
  });
  const {port} = server.address() as AddressInfo;
  const client = new OAuth2Client({...oAuth2ClientOptions, redirectUri: `http://localhost:${port}`});

  // TODO Add spinner
  const authCode = await new Promise<string>((resolve, reject) => {
    server.on('request', (request: ReadonlyDeep<IncomingMessage>, response: ReadonlyDeep<ServerResponse>) => {
      const urlParts = new URL(request.url ?? '', 'http://localhost').searchParams;
      const code = urlParts.get('code');
      const error = urlParts.get('error');
      if (code) {
        resolve(code);
      } else {
        reject(error);
      }

      response.end(LOG.AUTH_PAGE_SUCCESSFUL);
    });
    const authUrl = client.generateAuthUrl(oAuth2ClientAuthUrlOptions);
    console.log(LOG.AUTHORIZE(authUrl));
    (async () => open(authUrl))();
  });
  server.destroy();

  return (await client.getToken(authCode)).tokens;
};

/**
 * Requests authorization to manage Apps Script projects. Requires the user to
 * manually copy/paste the authorization code. No HTTP server is used.
 * @param {OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth.
 * @param {GenerateAuthUrlOpts} oAuth2ClientAuthUrlOptions Auth URL options
 */
const authorizeWithoutLocalhost = async (
  oAuth2ClientOptions: Readonly<OAuth2ClientOptions>,
  oAuth2ClientAuthUrlOptions: Readonly<GenerateAuthUrlOpts>
): Promise<Credentials> => {
  const client = new OAuth2Client({...oAuth2ClientOptions, redirectUri: REDIRECT_URI_OOB});
  console.log(LOG.AUTHORIZE(client.generateAuthUrl(oAuth2ClientAuthUrlOptions)));

  // TODO Add spinner
  const authCode = await new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    rl.question(LOG.AUTH_CODE, (code: string) => {
      rl.close();
      if (code && code.length > 0) {
        resolve(code);
      } else {
        reject(new ClaspError('No authorization code entered.'));
      }
    });
  });

  return (await client.getToken(authCode)).tokens;
};

/**
 * Set OAuth client credentails from rc.
 * Can be global or local.
 * Saves new credentials if access token refreshed.
 * @param {ClaspToken} rc OAuth client settings from rc file.
 */
// Because of mutation:
const setOauthClientCredentials = async (rc: ClaspToken) => {
  /**
   * Refreshes the credentials and saves them.
   */
  const refreshCredentials = async (oAuthClient: ReadonlyDeep<OAuth2Client>) => {
    await oAuthClient.getAccessToken(); // Refreshes expiry date if required
    rc.token = oAuthClient.credentials;
  };

  // Set credentials and refresh them.
  try {
    if (rc.isLocalCreds) {
      const {clientId, clientSecret, redirectUri} = rc.oauth2ClientSettings;
      localOAuth2Client = new OAuth2Client({clientId, clientSecret, redirectUri});
      localOAuth2Client.setCredentials(rc.token);
      await refreshCredentials(localOAuth2Client);
    } else {
      globalOAuth2Client.setCredentials(rc.token);
      await refreshCredentials(globalOAuth2Client);
    }
    // Save the credentials.
    await DOTFILE.AUTH(rc.isLocalCreds).write(rc);
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(`${ERROR.ACCESS_TOKEN}${error}`);
  }
};

// /**
//  * Compare global OAuth client scopes against manifest and prompt user to
//  * authorize if new scopes found (local OAuth credentails only).
//  * @param {ClaspToken} rc OAuth client settings from rc file.
//  */
// // TODO: currently unused. Check relevancy
// export async function checkOauthScopes(rc: ReadonlyDeep<ClaspToken>) {
//   try {
//     await checkIfOnline();
//     await setOauthClientCredentials(rc);
//     const {scopes} = await globalOAuth2Client.getTokenInfo(globalOAuth2Client.credentials.access_token as string);
//     const {oauthScopes} = await readManifest();
//     const newScopes = oauthScopes && oauthScopes.length > 1 ? oauthScopes.filter(x => !scopes.includes(x)) : [];
//     if (newScopes.length === 0) return;
//     console.log('New authorization scopes detected in manifest:\n', newScopes);
//     const answers = await oauthScopesPrompt();

//     if (answers.doAuth) {
//       if (!rc.isLocalCreds) throw new ClaspError(ERROR.NO_LOCAL_CREDENTIALS);
//       await authorize({useLocalhost: answers.localhost, scopes: newScopes});
//     }
//   } catch (error) {
//     if (error instanceof ClaspError) throw error;
//     throw new ClaspError(ERROR.BAD_REQUEST((error as {message: string}).message));
//   }
// }
