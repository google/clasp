/**
 * Clasp command method bodies.
 */
import fs from 'fs-extra';
import { enableAppsScriptAPI } from '../apiutils.js';
import { authorize, defaultScopes, getLoggedInEmail, scopeWebAppDeploy } from '../auth.js';
import { FS_OPTIONS } from '../constants.js';
import { readManifest } from '../manifest.js';
import { ERROR, LOG } from '../messages.js';
import { hasOauthClientSettings, safeIsOnline } from '../utils.js';
const { readJsonSync } = fs;
/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 * @param {boolean?} options.status If true, prints who is logged in instead of doing login.
 */
export default async (options) => {
    if (options.status) {
        if (hasOauthClientSettings()) {
            const email = (await safeIsOnline()) ? await getLoggedInEmail() : undefined;
            console.log(email ? LOG.LOGGED_IN_AS(email) : LOG.LOGGED_IN_UNKNOWN);
        }
        else {
            console.log(LOG.NOT_LOGGED_IN);
        }
        return;
    }
    // Local vs global checks
    const isLocalLogin = Boolean(options.creds);
    if (isLocalLogin && hasOauthClientSettings(true)) {
        console.error(ERROR.LOGGED_IN_LOCAL);
    }
    if (!isLocalLogin && hasOauthClientSettings(false)) {
        console.error(ERROR.LOGGED_IN_GLOBAL);
    }
    console.log(LOG.LOGIN(isLocalLogin));
    // Localhost check
    const useLocalhost = Boolean(options.localhost);
    // Using own credentials.
    if (options.creds) {
        // First read the manifest to detect any additional scopes in "oauthScopes" fields.
        // In the script.google.com UI, these are found under File > Project Properties > Scopes
        const { oauthScopes = [] } = await readManifest();
        const scopes = [...new Set([...oauthScopes, scopeWebAppDeploy])];
        console.log('');
        console.log('Authorizing with the following scopes:');
        for (const scope of scopes) {
            console.log(scope);
        }
        console.log(`\nNOTE: The full list of scopes your project may need can be found at script.google.com under:
File > Project Properties > Scopes\n`);
        // Read credentials file.
        const creds = readJsonSync(options.creds, FS_OPTIONS);
        await authorize({ creds, scopes, useLocalhost });
        await enableAppsScriptAPI();
        return;
    }
    // Not using own credentials
    // Use the default scopes needed for clasp.
    await authorize({ scopes: defaultScopes, useLocalhost });
};
//# sourceMappingURL=login.js.map