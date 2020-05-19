/**
 * Clasp command method bodies.
 */
import { readJsonSync } from 'fs-extra';

import { enableAppsScriptAPI } from '../apiutils';
import { authorize, getLoggedInEmail } from '../auth';
import { FS_OPTIONS } from '../files';
import { readManifest } from '../manifest';
import { checkIfOnline, ERROR, hasOauthClientSettings, LOG, safeIsOnline } from '../utils';

/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 * @param {boolean?} options.status If true, prints who is logged in instead of doing login.
 */
export default async (options: { localhost?: boolean; creds?: string; status?: boolean }): Promise<void> => {
  if (options.status) {
    if (hasOauthClientSettings()) {
      const email = (await safeIsOnline()) ? await getLoggedInEmail() : undefined;

      if (email) {
        console.log(LOG.LOGGED_IN_AS(email));
      } else {
        console.log(LOG.LOGGED_IN_UNKNOWN);
      }
    } else {
      console.log(LOG.NOT_LOGGED_IN);
    }
    // process.exit(0);
  } else {
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
      console.log('Authorizing with the following scopes:');
      oauthScopes.forEach((scope) => {
        console.log(scope);
      });
      console.log(`
  NOTE: The full list of scopes your project may need can be found at script.google.com under:
  File > Project Properties > Scopes
  `);

      // Read credentials file.
      const credentials = readJsonSync(options.creds, FS_OPTIONS);
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
          'https://www.googleapis.com/auth/userinfo.email', // User email address
          'https://www.googleapis.com/auth/userinfo.profile',

          // Extra scope since service.management doesn't work alone
          'https://www.googleapis.com/auth/cloud-platform',
        ],
      });
    }
    // process.exit(0); // gracefully exit after successful login
  }
};
