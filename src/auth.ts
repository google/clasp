import {readFileSync} from 'fs';
import {createServer} from 'http';
import type {IncomingMessage, Server, ServerResponse} from 'http';
import type {AddressInfo} from 'net';
import {GoogleAuth, OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';
import open from 'open';
import enableDestroy from 'server-destroy';
import {ClaspError} from './clasp-error.js';
import {FileCredentialStore} from './credential_store.js';
import {ERROR, LOG} from './messages.js';

let activeUserKey = 'default';
let useAdc = false;
const activeCredentialStore = new FileCredentialStore();

export function setActiveUserKey(userKey: string) {
  activeUserKey = userKey;
}

export function useApplicationDefaultCredentials(enabled = true) {
  useAdc = enabled;
}

/**
 * Creates an an unauthorized oauth2 client given the client secret file. If no path is provided,
 * teh default client is returned.
 * @param clientSecretPath
 * @returns
 */
export function getUnauthorizedOuth2Client(clientSecretPath?: string): OAuth2Client {
  if (clientSecretPath) {
    return createOauthClient(clientSecretPath);
  }
  return createDefaultOAuthClient();
}

const credentialsCache: Map<string, OAuth2Client> = new Map();

/**
 * Create an authorized oauth2 client from saved credentials.
 * @param userKey
 * @returns
 */
export async function getAuthorizedOAuth2Client(userKey?: string): Promise<OAuth2Client | null> {
  if (useAdc) {
    return createApplicationDefaultCredentials();
  }

  if (!userKey) {
    userKey = activeUserKey ?? 'default';
  }

  let client = credentialsCache.get(userKey);
  if (client) {
    return client;
  }

  const savedCredentials = await activeCredentialStore.load(userKey);
  if (!savedCredentials) {
    return null;
  }

  client = new GoogleAuth().fromJSON(savedCredentials) as OAuth2Client;
  client.setCredentials(savedCredentials);
  client.on('tokens', async tokens => {
    const refreshedCredentials = {
      ...savedCredentials,
      expiry_date: tokens.expiry_date,
      access_token: tokens.access_token,
      id_token: tokens.access_token,
    };
    await activeCredentialStore.save(userKey!, refreshedCredentials);
  });
  credentialsCache.set(userKey, client);
  return client;
}

export type AuthorizationOptions = {
  noLocalServer?: boolean;
  redirectPort?: number;
  scopes: string[] | string;
  oauth2Client: OAuth2Client;
};

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] List of OAuth scopes to authorize.
 * @param {number?} redirectPort Optional custom port for the local HTTP server during the authorization process.
 *                               If not specified, a random available port will be used.
 */
export async function authorize(options: AuthorizationOptions) {
  let flow: AuthorizationCodeFlow;
  if (options.noLocalServer) {
    flow = new ServerlessAuthorizationCodeFlow(options.oauth2Client);
  } else {
    flow = new LocalServerAuthorizationCodeFlow(options.oauth2Client);
  }

  const client = await flow.authorize(options.scopes);
  return saveOauthClientCredentials(activeUserKey, client);
}

export async function logout() {
  await activeCredentialStore.delete(activeUserKey);
  credentialsCache.delete(activeUserKey);
}

export async function logoutAll() {
  await activeCredentialStore.deleteAll();
  credentialsCache.delete(activeUserKey);
}

async function saveOauthClientCredentials(userKey: string, oauth2Client: OAuth2Client) {
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
    await activeCredentialStore.save(userKey, refreshedCredentials);
  });
  await activeCredentialStore.save(userKey, savedCredentials);
  credentialsCache.set(userKey, oauth2Client);
}

class AuthorizationCodeFlow {
  protected oauth2Client: OAuth2Client;

  constructor(oauth2client: OAuth2Client) {
    this.oauth2Client = oauth2client;
  }

  async authorize(scopes: string | string[]) {
    const scope = Array.isArray(scopes) ? scopes.join(' ') : scopes;
    const redirectUri = await this.getRedirectUri();
    const authUrl = this.oauth2Client.generateAuthUrl({
      redirect_uri: redirectUri,
      access_type: 'offline',
      scope: scope,
    });
    const code = await this.promptAndReturnCode(authUrl);
    const tokens = await this.oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });
    this.oauth2Client.setCredentials(tokens.tokens);
    return this.oauth2Client;
  }

  async getRedirectUri(): Promise<string> {
    throw new Error('Not implemented');
  }

  async promptAndReturnCode(_authorizationUrl: string): Promise<string> {
    throw new Error('Not implemented');
  }
}

class ServerlessAuthorizationCodeFlow extends AuthorizationCodeFlow {
  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

  async getRedirectUri(): Promise<string> {
    return 'http://localhost:8888';
  }

  async promptAndReturnCode(authorizationUrl: string) {
    console.log(
      `Authorize clasp by visiting the following URL on another device:\n\n\t${authorizationUrl}\n\nAfter authorization, copy and paste the URL in the browser here.\n`,
    );
    const answer = await inquirer.prompt([
      {
        message: 'Enter the URL from your browser after completing authorization',
        name: 'url',
        type: 'input',
      },
    ]);
    const {code, error} = parseAuthResponseUrl(answer.url);
    if (error) {
      throw new Error(error);
    }
    if (!code) {
      throw new Error('Missing code in responde URL');
    }
    return code;
  }
}

class LocalServerAuthorizationCodeFlow extends AuthorizationCodeFlow {
  protected server: Server | undefined;
  protected port = 0;

  constructor(oauth2client: OAuth2Client) {
    super(oauth2client);
  }

  async getRedirectUri(): Promise<string> {
    this.server = await new Promise<Server>((resolve, reject) => {
      const s = createServer();
      enableDestroy(s);
      s.listen(this.port, () => resolve(s)).on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `Error: Port ${this.port} is already in use. Please specify a different port with --redirect-port.`,
          );
        } else {
          console.error(`Error: Unable to start the server on port ${this.port}.`, err.message);
        }
        reject(err);
      });
    });
    const {port} = this.server.address() as AddressInfo;
    return `http://localhost:${port}`;
  }

  async promptAndReturnCode(authorizationUrl: string) {
    return await new Promise<string>((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not started'));
        return;
      }
      this.server.on('request', (request: IncomingMessage, response: ServerResponse) => {
        if (!request.url) {
          reject(new Error('Missing URL in request'));
          return;
        }
        const {code, error} = parseAuthResponseUrl(request.url);
        if (code) {
          resolve(code);
        } else {
          reject(error);
        }

        response.end(LOG.AUTH_PAGE_SUCCESSFUL);
      });
      void open(authorizationUrl);
      console.log(LOG.AUTHORIZE(authorizationUrl));
    }).finally(() => this.server?.destroy());
  }
}

function parseAuthResponseUrl(url: string) {
  const urlParts = new URL(url, 'http://localhost/').searchParams;
  const code = urlParts.get('code');
  const error = urlParts.get('error');
  return {
    code,
    error,
  };
}

/**
 * Creates an aunthorized oauth2 client with the given credentials
 * @param clientSecretPath
 * @returns
 */
function createOauthClient(clientSecretPath: string) {
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
  return new OAuth2Client({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri: redirectUrl,
  });
}

/**
 * Creates an aunthorized oauth2 client using the default id & secret.
 * @param clientSecretPath
 * @returns
 */
function createDefaultOAuthClient() {
  // Default client
  return new OAuth2Client({
    clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
    clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
    redirectUri: 'http://localhost',
  });
}

async function createApplicationDefaultCredentials() {
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
    return defaultCreds as OAuth2Client;
  }
  return null;
}
export async function getAuthorizedOAuth2ClientOrDie() {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS);
  }
  return oauth2Client;
}
