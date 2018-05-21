import { OAuth2Client } from 'google-auth-library';
import { ClaspSettings, DOTFILE, ERROR } from './utils';
import * as http from 'http';
import * as url from 'url';
import open = require('open');
import readline = require('readline');
import { LOG } from './commands';

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
  ],
};
const oauth2ClientSettings = {
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
};
export const oauth2Client = new OAuth2Client(oauth2ClientSettings);

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 * @param {Function} cb The callback
 * @param {boolean} isLocal If we should load local API credentials for this clasp project.
 */
export function getAPICredentials(cb: (rc: ClaspSettings | void) => void) {
    DOTFILE.RC_LOCAL.read().then((rc: ClaspSettings) => {
      oauth2Client.setCredentials(rc);
      cb(rc);
    }).catch((err: object) => {
      DOTFILE.RC.read().then((rc: ClaspSettings) => {
        oauth2Client.setCredentials(rc);
        cb(rc);
      }).catch((err: object) => {
        console.error('Could not read API credentials. Error:');
        console.error(err);
        process.exit(-1);
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
  const client = new OAuth2Client({
    ...oauth2ClientSettings,
    redirectUri: `http://localhost:${server.address().port}`});
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
        rej("No authorization code entered.");
      }
      rl.close();
    });
  });
  return (await client.getToken(authCode)).tokens;
}

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 */
export async function authorize(useLocalhost: boolean, writeToOwnKey: boolean) {
  try {
    const token = await (useLocalhost ? authorizeWithLocalhost() : authorizeWithoutLocalhost());
    await (writeToOwnKey ? DOTFILE.RC_LOCAL.write(token) : DOTFILE.RC.write(token));
    console.log(LOG.AUTH_SUCCESSFUL);
  } catch(err) {
    console.error(ERROR.ACCESS_TOKEN + err);
  }
}
