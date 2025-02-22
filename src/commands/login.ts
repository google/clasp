/**
 * Clasp command method bodies.
 */

import {Command} from 'commander';
import {AuthInfo, authorize, getUnauthorizedOuth2Client, getUserInfo} from '../auth/auth.js';
import {Clasp} from '../core/clasp.js';
import {ERROR, LOG} from '../messages.js';

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

export const command = new Command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .option('--creds <file>', 'Relative path to OAuth client secret file (from GCP).')
  .option(
    '--use-project-scopes',
    'Use the scopes from the current project manifest. Used only when authorizing access for the run command.',
  )
  .option('--redirect-port <port>', 'Specify a custom port for the redirect URL.')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const auth: AuthInfo = this.opts().auth;
    const clasp: Clasp = this.opts().clasp;

    if (!auth.credentialStore) {
      this.error('No credential store found, unable to login.');
      return;
    }

    if (auth.credentials) {
      console.error(ERROR.LOGGED_IN);
    }

    const useLocalhost = Boolean(options.localhost);
    const redirectPort = options.redirectPort;

    const oauth2Client = getUnauthorizedOuth2Client(options.creds);

    let scopes = [...DEFAULT_SCOPES];
    if (options.useProjectScopes) {
      const manifest = await clasp.project.readManifest();
      scopes = manifest.oauthScopes ?? scopes;
      console.log('');
      console.log('Authorizing with the following scopes:');
      for (const scope of scopes) {
        console.log(scope);
      }
    }

    const credentials = await authorize({
      store: auth.credentialStore,
      userKey: auth.user,
      oauth2Client,
      scopes,
      noLocalServer: !useLocalhost,
      redirectPort,
    });

    const user = await getUserInfo(credentials);
    if (!user || !user.email) {
      console.log(LOG.LOGGED_IN_UNKNOWN);
      return;
    }

    console.log(LOG.LOGGED_IN_AS(user.email));
  });
