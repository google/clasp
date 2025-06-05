// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Implements the `clasp login` command, which allows users to
 * authenticate with Google and authorize clasp to manage their Apps Script projects.
 * It supports different authentication flows, including using a local server
 * or manually entering an authorization code.
 */

import {Command} from 'commander';
import {AuthInfo, authorize, getUnauthorizedOuth2Client, getUserInfo} from '../auth/auth.js';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';

/**
 * Default OAuth scopes required by clasp for its operations.
 */
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/script.deployments', // Manage Apps Script deployments
  'https://www.googleapis.com/auth/script.projects', // Manage Apps Script projects
  'https://www.googleapis.com/auth/script.webapp.deploy', // Deploy Apps Script Web Apps
  'https://www.googleapis.com/auth/drive.metadata.readonly', // View Drive file metadata
  'https://www.googleapis.com/auth/drive.file', // Create and manage Drive files (for project creation)
  'https://www.googleapis.com/auth/service.management', // Manage Google Cloud Platform project services
  'https://www.googleapis.com/auth/logging.read', // Read Stackdriver logs
  'https://www.googleapis.com/auth/userinfo.email', // Get user's email address
  'https://www.googleapis.com/auth/userinfo.profile', // Get user's profile information
  'https://www.googleapis.com/auth/cloud-platform', // General Google Cloud Platform access
];

/**
 * Interface for the command options specific to the `login` command.
 */
interface CommandOption {
  /** If true, forces the serverless authentication flow (manual code copy-paste). Otherwise, tries local server. */
  readonly localhost?: boolean; // Note: commander sets this to `false` if --no-localhost is present, so true means use localhost.
  /** Path to a custom OAuth client secrets file. */
  readonly creds?: string;
  /** Port for the local redirect server. */
  readonly redirectPort?: number;
  /** If true, uses scopes defined in the project's manifest file instead of default scopes. */
  readonly useProjectScopes?: boolean;
}

/**
 * Command to authenticate the user with Google and authorize clasp.
 * Handles OAuth 2.0 flow, storing credentials for future use.
 */
export const command = new Command('login')
  .description('Log in to script.google.com and authorize clasp.')
  .option('--no-localhost', 'Explicitly prevent running a local server for authentication, forcing manual code entry.')
  .option('--creds <file>', 'Path to a custom OAuth client secrets JSON file (e.g., for domain-wide delegation).')
  .option(
    '--use-project-scopes',
    'Use OAuth scopes defined in the project manifest (`appsscript.json`) instead of clasp default scopes.',
  )
  .option('--redirect-port <port>', 'Specify a custom port for the local OAuth redirect server.')
  /**
   * Action handler for the `login` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const auth: AuthInfo = this.opts().auth; // AuthInfo is pre-initialized by program.ts hook
    const clasp: Clasp = this.opts().clasp; // Clasp instance is pre-initialized

    if (!auth.credentialStore) {
      // This should ideally not happen if preAction hooks run correctly.
      const msg = intl.formatMessage({
        defaultMessage: 'Credential store not initialized. This is an unexpected error.',
      });
      this.error(msg);
    }

    // Check if already logged in.
    if (auth.credentials) {
      const user = await getUserInfo(auth.credentials);
      const loggedInMsg = intl.formatMessage(
        {defaultMessage: 'You are already logged in as {email}.'},
        {email: user?.email ?? 'an unknown user'},
      );
      console.log(loggedInMsg);
      // Optionally, ask if they want to re-authenticate or add another account.
      // For now, just exits.
      return;
    }

    // Determine if local server should be used. Commander sets `localhost` to `false` if `--no-localhost` is present.
    // So, `options.localhost` being `undefined` or `true` means use local server.
    const useLocalServer = options.localhost !== false;
    const redirectPort = options.redirectPort;

    // Get an unauthorized client, either default or from provided creds file.
    const oauth2Client = getUnauthorizedOuth2Client(options.creds);

    let scopesToAuthorize = [...DEFAULT_SCOPES];
    // If useProjectScopes is true, try to load scopes from the project manifest.
    if (options.useProjectScopes) {
      try {
        const manifest = await clasp.project.readManifest();
        if (manifest.oauthScopes && manifest.oauthScopes.length > 0) {
          scopesToAuthorize = manifest.oauthScopes;
          const scopesLabel = intl.formatMessage({
            defaultMessage: 'Authorizing with the following scopes from project manifest:',
          });
          console.log(`\n${scopesLabel}`);
          scopesToAuthorize.forEach(scope => console.log(`- ${scope}`));
          console.log(''); // Newline for readability
        } else {
          console.log(intl.formatMessage({defaultMessage: 'No OAuth scopes found in project manifest. Using default clasp scopes.'}));
        }
      } catch (err) {
        // Error reading manifest (e.g., not in a project directory, or manifest is malformed)
        console.warn(intl.formatMessage({defaultMessage: 'Could not read project manifest to get scopes. Using default clasp scopes. Error: {errorMessage}'}, {errorMessage: err.message}));
      }
    }

    // Perform the authorization flow.
    const authorizedCredentials = await authorize({
      store: auth.credentialStore!, // Safe due to earlier check.
      userKey: auth.user,
      oauth2Client,
      scopes: scopesToAuthorize,
      noLocalServer: !useLocalServer,
      redirectPort,
    });

    // Confirm login by fetching user info.
    const user = await getUserInfo(authorizedCredentials);
    const msg = intl.formatMessage(
      {
        defaultMessage: `{email, select,
        undefined {You are logged in as an unknown user.}
        other {You are logged in as {email}.}}`,
      },
      {
        email: user?.email,
      },
    );
    console.log(msg);
  });
