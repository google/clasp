/**
 * Clasp command method bodies.
 */

import {Command} from 'commander';
import {google} from 'googleapis';
import {authorize, getUnauthorizedOuth2Client} from '../auth.js';
import {Context, assertScriptSettings} from '../context.js';
import {ERROR, LOG} from '../messages.js';
import {safeIsOnline} from '../utils.js';

const DEFAULT_SCOPES = [
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
  'https://www.googleapis.com/auth/cloud-platform',
];

interface CommandOption {
  readonly localhost?: boolean;
  readonly creds?: string;
  readonly status?: boolean;
  readonly redirectPort?: number;
  readonly useProjectScopes?: boolean;
}

async function showLoginStatus(context: Context): Promise<void> {
  if (!context.credentials) {
    console.log(LOG.NOT_LOGGED_IN);
    return;
  }

  const isOnline = await safeIsOnline();
  if (!isOnline) {
    console.log(LOG.LOGGED_IN_UNKNOWN);
    return;
  }

  const api = google.oauth2('v2');
  const res = await api.userinfo.get({auth: context.credentials});
  if (res.status !== 200) {
    console.log(LOG.LOGGED_IN_UNKNOWN);
    return;
  }
  const email = res.data.email;
  if (email) {
    console.log(LOG.LOGGED_IN_AS(email));
  } else {
    console.log(LOG.LOGGED_IN_UNKNOWN);
  }
}
/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 * @param {boolean?} options.status If true, prints who is logged in instead of doing login.
 */
export async function loginCommand(this: Command, options: CommandOption): Promise<void> {
  const context: Context = this.opts().context;

  if (options.status) {
    // TODO - Refactor as subcommand
    await showLoginStatus(context);
    return;
  }

  if (context.credentials) {
    console.error(ERROR.LOGGED_IN);
  }

  const useLocalhost = Boolean(options.localhost);
  const redirectPort = options.redirectPort;

  const oauth2Client = getUnauthorizedOuth2Client(options.creds);

  let scopes = [...DEFAULT_SCOPES];
  if (options.useProjectScopes) {
    assertScriptSettings(context);
    scopes = context.project.manifest?.oauthScopes ?? scopes;
    console.log('');
    console.log('Authorizing with the following scopes:');
    for (const scope of scopes) {
      console.log(scope);
    }
  }

  await authorize({
    store: context.credentialStore,
    userKey: context.userKey,
    oauth2Client,
    scopes,
    noLocalServer: !useLocalhost,
    redirectPort,
  });

  await showLoginStatus(context);
  return;
}
