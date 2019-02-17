/**
 * Clasp command method bodies.
 */
import { readFileSync } from 'fs';
import {
  enableAppsScriptAPI,
} from '../apiutils';
import {
  authorize,
} from '../auth';
import {
  readManifest,
} from '../manifest';
import {
  ERROR,
  LOG,
  checkIfOnline,
  hasOauthClientSettings,
} from '../utils';

/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 */
export default async (options: { localhost?: boolean; creds?: string }) => {
  // Local vs global checks
  const isLocalLogin = !!options.creds;
  const loggedInLocal = hasOauthClientSettings(true);
  const loggedInGlobal = hasOauthClientSettings(false);
  if (isLocalLogin && loggedInLocal) console.error(ERROR.LOGGED_IN_LOCAL);
  if (!isLocalLogin && loggedInGlobal) console.error(ERROR.LOGGED_IN_GLOBAL);
  console.log(LOG.LOGIN(isLocalLogin));
  await checkIfOnline();

  // Localhost check
  const useLocalhost = !!options.localhost;

  // Using own credentials.
  if (options.creds) {
    let oauthScopes: string[] = [];
    // First read the manifest to detect any additional scopes in "oauthScopes" fields.
    // In the script.google.com UI, these are found under File > Project Properties > Scopes
    const manifest = await readManifest();
    oauthScopes = manifest.oauthScopes || [];
    oauthScopes = oauthScopes.concat([
      'https://www.googleapis.com/auth/script.webapp.deploy', // Scope needed for script.run
    ]);
    console.log('');
    console.log(`Authorizing with the following scopes:`);
    oauthScopes.map((scope) => {
      console.log(scope);
    });
    console.log('');
    console.log(`NOTE: The full list of scopes you're project may need` +
      ` can be found at script.google.com under:`);
    console.log(`File > Project Properties > Scopes`);
    console.log('');

    // Read credentials file.
    const credsFile = readFileSync(options.creds, 'utf8');
    const credentials = JSON.parse(credsFile);
    await authorize({
      useLocalhost,
      creds: credentials,
      scopes: oauthScopes,
    });
    await enableAppsScriptAPI();
  } else {
    // Not using own credentials
    await authorize({
      useLocalhost,
      scopes: [
        // Use the default scopes needed for clasp.
        'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
        'https://www.googleapis.com/auth/script.projects', // Apps Script management
        'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
        'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
        'https://www.googleapis.com/auth/drive.file', // Create Drive files
        'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
        'https://www.googleapis.com/auth/logging.read', // StackDriver logs

        // Extra scope since service.management doesn't work alone
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    });
  }
  process.exit(0); // gracefully exit after successful login
};