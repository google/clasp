import { google, Auth } from 'googleapis';
import { createServer } from 'http';
import open from 'open';
import readline from 'readline';
import enableDestroy from 'server-destroy';
import { ClaspError } from './clasp-error.js';
import { DOTFILE } from './dotfile.js';
import { ERROR, LOG } from './messages.js';
import { getOAuthSettings } from './utils.js';
/**
 * Authentication with Google's APIs.
 */
// Auth is complicated. Consider yourself warned.
// GLOBAL: clasp login will store this (~/.clasprc.json):
// LOCAL: clasp login will store this (./.clasprc.json):
// The shape is specified by dotfile.ts ClaspToken
// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const globalOauth2ClientSettings = {
    clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
    clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
    redirectUri: 'http://localhost',
};
const globalOAuth2Client = new Auth.OAuth2Client(globalOauth2ClientSettings);
let localOAuth2Client; // Must be set up after authorize.
// *Global* Google API clients
// @todo this is flawed, it is consuming the globalOauthClient to access
// any google apis, where local logins will be ignored
export const discovery = google.discovery({ version: 'v1' });
export const drive = google.drive({ version: 'v3', auth: globalOAuth2Client });
export const logger = google.logging({ version: 'v2', auth: globalOAuth2Client });
export const script = google.script({ version: 'v1', auth: globalOAuth2Client });
export const serviceUsage = google.serviceusage({ version: 'v1', auth: globalOAuth2Client });
/**
 * Gets the local OAuth client for the Google Apps Script API.
 * Only the Apps Script API needs to use local credential for the Execution API (script.run).
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 */
export const getLocalScript = async () => google.script({ version: 'v1', auth: localOAuth2Client });
export const scopeWebAppDeploy = 'https://www.googleapis.com/auth/script.webapp.deploy'; // Scope needed for script.run
export const defaultScopes = [
    // Default to clasp scopes
    'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/script.projects',
    scopeWebAppDeploy,
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/service.management',
    'https://www.googleapis.com/auth/logging.read',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    // Extra scope since service.management doesn't work alone
    'https://www.googleapis.com/auth/cloud-platform',
];
/**
 * Requests authorization to manage Apps Script projects.
 */
export const authorize = async (options) => {
    if (!options.creds) {
        // Default to OAuth authorization
        // Use global oauth2 options
        const globalOauth2ClientOptions = {
            clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
            clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
            redirectUri: 'http://localhost',
        };
        return await authorizeWithOauth({ ...options, scopes: defaultScopes }, globalOauth2ClientOptions);
    }
    // By default on login https://github.com/google/clasp/blob/551000b55565d20fccc29673c5460022d42ee5cf/src/commands/login.ts#L60,
    // it is read with scopeWebAppDeploy, this is insufficient scope for pushing
    // scripts since it requires at least service.management and script.project scopes
    // Assuming that if you were specifying scopes in the settings, that there will be at least 2 scopes listed hence
    // the check for length > 1
    const scopes = options.scopes.length > 1 ? options.scopes : defaultScopes;
    // Credentials were provided by the CLI
    // Check to see if this is a service account
    if ('type' in options.creds) {
        // This is a JWT authorization
        try {
            // @todo support api keys
            const client = new google.auth.JWT({ scopes: scopes });
            client.fromJSON(options.creds);
            console.log(LOG.CREDS_FROM_PROJECT(options.creds.project_id || 'not specified'));
            const token = await client.authorize();
            const claspToken = {
                token,
                oauth2ClientSettings: globalOauth2ClientSettings,
                isLocalCreds: false,
            };
            await DOTFILE.AUTH(claspToken.isLocalCreds).write(claspToken);
            return client;
        }
        catch (error) {
            if (error instanceof ClaspError) {
                throw error;
            }
            throw new ClaspError(`${ERROR.UNAUTHENTICATED}${error}`);
        }
    }
    // This is an OAuth authorization with credentials file provided
    try {
        // Use local credentials
        const { client_id: clientId, client_secret: clientSecret, project_id, redirect_uris: redirectUris, } = options.creds.installed;
        console.log(LOG.CREDS_FROM_PROJECT(project_id));
        const oAuth2ClientOptions = { clientId, clientSecret, redirectUri: redirectUris[0] };
        return await authorizeWithOauth({ ...options, scopes }, oAuth2ClientOptions);
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(`${ERROR.UNAUTHENTICATED}${error}`);
    }
};
async function authorizeWithOauth(options, oAuth2ClientOptions) {
    try {
        const oAuth2ClientAuthUrlOptions = {
            access_type: 'offline',
            scope: options.scopes,
        };
        // Grab a token from the credentials.
        const authorizationFunction = options.useLocalhost ? authorizeWithLocalhost : authorizeWithoutLocalhost;
        const token = await authorizationFunction(oAuth2ClientOptions, oAuth2ClientAuthUrlOptions);
        console.log(`${LOG.AUTH_SUCCESSFUL}\n`);
        // Save the token and own creds together.
        let claspToken;
        if (options.creds) {
            const { client_id: clientId, client_secret: clientSecret, redirect_uris: redirectUri, } = options.creds.installed;
            // Save local ClaspCredentials.
            claspToken = {
                token,
                oauth2ClientSettings: { clientId, clientSecret, redirectUri: redirectUri[0] },
                isLocalCreds: true,
            };
        }
        else {
            // Save global ClaspCredentials.
            claspToken = {
                token,
                oauth2ClientSettings: globalOauth2ClientSettings,
                isLocalCreds: false,
            };
        }
        await DOTFILE.AUTH(claspToken.isLocalCreds).write(claspToken);
        console.log(LOG.SAVED_CREDS(Boolean(options.creds)));
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(`${ERROR.ACCESS_TOKEN}${error}`);
    }
}
export const getLoggedInEmail = async () => {
    await loadAPICredentials();
    try {
        return (await google.oauth2('v2').userinfo.get({ auth: globalOAuth2Client })).data.email;
    }
    catch {
        return;
    }
};
/**
 * Loads the Apps Script API credentials for the CLI.
 *
 * Required before every API call.
 */
export const loadAPICredentials = async (local = false) => {
    // Gets the OAuth settings. May be local or global.
    const rc = await getOAuthSettings(local);
    await setOauthClientCredentials(rc);
    return rc;
};
/**
 * Requests authorization to manage Apps Script projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 * @param {Auth.OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth
 * @param {Auth.GenerateAuthUrlOpts} oAuth2ClientAuthUrlOptions Auth URL options
 * Used for local/global testing.
 */
const authorizeWithLocalhost = async (oAuth2ClientOptions, oAuth2ClientAuthUrlOptions) => {
    // Wait until the server is listening, otherwise we don't have
    // the server port needed to set up the Auth.OAuth2Client.
    const server = await new Promise(resolve => {
        const s = createServer();
        enableDestroy(s);
        s.listen(0, () => resolve(s));
    });
    const { port } = server.address();
    const client = new Auth.OAuth2Client({ ...oAuth2ClientOptions, redirectUri: `http://localhost:${port}` });
    // TODO Add spinner
    const authCode = await new Promise((resolve, reject) => {
        server.on('request', (request, response) => {
            var _a;
            const urlParts = new URL((_a = request.url) !== null && _a !== void 0 ? _a : '', 'http://localhost').searchParams;
            const code = urlParts.get('code');
            const error = urlParts.get('error');
            if (code) {
                resolve(code);
            }
            else {
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
 * @param {Auth.OAuth2ClientOptions} oAuth2ClientOptions The required client options for auth.
 * @param {Auth.GenerateAuthUrlOpts} oAuth2ClientAuthUrlOptions Auth URL options
 */
const authorizeWithoutLocalhost = async (oAuth2ClientOptions, oAuth2ClientAuthUrlOptions) => {
    const client = new Auth.OAuth2Client({ ...oAuth2ClientOptions, redirectUri: REDIRECT_URI_OOB });
    console.log(LOG.AUTHORIZE(client.generateAuthUrl(oAuth2ClientAuthUrlOptions)));
    // TODO Add spinner
    const authCode = await new Promise((resolve, reject) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(LOG.AUTH_CODE, (code) => {
            rl.close();
            if (code && code.length > 0) {
                resolve(code);
            }
            else {
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
const setOauthClientCredentials = async (rc) => {
    /**
     * Refreshes the credentials and saves them.
     */
    const refreshCredentials = async (oAuthClient) => {
        await oAuthClient.getAccessToken(); // Refreshes expiry date if required
        rc.token = oAuthClient.credentials;
    };
    // Set credentials and refresh them.
    try {
        if (rc.isLocalCreds) {
            const { clientId, clientSecret, redirectUri } = rc.oauth2ClientSettings;
            localOAuth2Client = new Auth.OAuth2Client({ clientId, clientSecret, redirectUri });
            localOAuth2Client.setCredentials(rc.token);
            await refreshCredentials(localOAuth2Client);
        }
        else {
            globalOAuth2Client.setCredentials(rc.token);
            await refreshCredentials(globalOAuth2Client);
        }
        // Save the credentials.
        await DOTFILE.AUTH(rc.isLocalCreds).write(rc);
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(`${ERROR.ACCESS_TOKEN}${error}`);
    }
};
//# sourceMappingURL=auth.js.map