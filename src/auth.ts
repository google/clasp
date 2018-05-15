import { OAuth2Client } from 'google-auth-library';
import { ClaspSettings, DOTFILE } from './utils.js';
import * as http from 'http';
import * as url from 'url';
const open = require('open');
const readline = require('readline');
import { LOG } from './commands.js';

// API settings
// @see https://developers.google.com/oauthplayground/
export const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
export const oauth2Client = new OAuth2Client({
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
});

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
 * Requests authorization to manage Apps Scrpit projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 *
 * @param {Object} opts OAuth2 options TODO formalize options
 * @return {Promise} Promise resolving with the authorization code
 */
export function authorizeWithLocalhost(opts: any): Promise<string> {
    return new Promise((res: Function, rej: Function) => {
      const server = http.createServer((req: http.ServerRequest, resp: http.ServerResponse) => {
        const urlParts = url.parse(req.url || '', true);
        if (urlParts.query.code) {
          res(urlParts.query.code);
        } else {
          rej(urlParts.query.error);
        }
        resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
        setTimeout(() => { // TODO Remove hack to shutdown server.
          process.exit();
        }, 1000);
      });

      server.listen(0, () => {
        oauth2Client.redirectUri = `http://localhost:${server.address().port}`;
        const authUrl = oauth2Client.generateAuthUrl(opts);
        console.log(LOG.AUTHORIZE(authUrl));
        open(authUrl);
      });
    });
  }

/**
 * Requests authorization to manage Apps Script projects. Requires the
 * user to manually copy/paste the authorization code. No HTTP server is
 * used.
 *
 * @param {Object} opts OAuth2 options
 * @return {Promise} Promise resolving with the authorization code
 */
export function authorizeWithoutLocalhost(opts: any): Promise<string> {
    oauth2Client.redirectUri = REDIRECT_URI_OOB;
    const authUrl = oauth2Client.generateAuthUrl(opts);
    console.log(LOG.AUTHORIZE(authUrl));

    return new Promise((res, rej) => {
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
  }