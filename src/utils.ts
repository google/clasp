/* eslint-disable camelcase,new-cap */
import cliTruncate from 'cli-truncate';
import {Spinner} from 'cli-spinner';
import fs from 'fs-extra';
import {script_v1 as scriptV1} from 'googleapis';
import isOnline from 'is-online';
import path from 'path';

import {ClaspToken, DOT, DOTFILE, ProjectSettings} from './dotfile';
import {projectIdPrompt} from './inquirer';
import {ERROR, LOG} from './messages';

const ucfirst = (value: string) => value && `${value[0].toUpperCase()}${value.slice(1)}`;

/**
 * The installed credentials. This is a file downloaded from console.developers.google.com
 * Credentials > OAuth 2.0 client IDs > Type:Other > Download
 * Usually called: creds.json
 * @see https://console.developers.google.com/apis/credentials
 */
interface ClaspCredentialsInstalled {
  client_id: string;
  project_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_secret: string;
  redirect_uris: string[];
}

export interface ClaspCredentials {
  installed: ClaspCredentialsInstalled;
}

/**
 * Checks if OAuth client settings rc file exists.
 * @param  {boolean} local check ./clasprc.json instead of ~/.clasprc.json
 * @return {boolean}
 */
export const hasOauthClientSettings = (local = false): boolean =>
  fs.existsSync(local ? DOT.RC.ABSOLUTE_LOCAL_PATH : DOT.RC.ABSOLUTE_PATH);

/**
 * Gets the OAuth client settings from rc file.
 * @param {boolean} local If true, gets the local OAuth settings. Global otherwise.
 * ! Should be used instead of `DOTFILE.RC?().read()`
 * @returns {Promise<ClaspToken>} A promise to get the rc file as object.
 */
export async function getOAuthSettings(local: boolean): Promise<ClaspToken> {
  const RC = local ? DOTFILE.RC_LOCAL() : DOTFILE.RC;
  return RC.read<ClaspToken>().catch((error: Error) => logError(error, ERROR.NO_CREDENTIALS(local)));
}

export const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied and exits Node.
 *
 * > This function **`never`** returns
 *
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 * @param  {number} code        (*optional*) The process exit code. default value is `1`
 */
export const logError = (err: any, description = '', code = 1): never => {
  if (spinner.isSpinning()) spinner.stop(true);
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    description = JSON.parse(err.error).error;
  } else if (err?.statusCode === 401 || (err?.error && err.error.error && err.error.error.code === 401)) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.UNAUTHENTICATED : ERROR.UNAUTHENTICATED_LOCAL
    description = ERROR.UNAUTHENTICATED;
  } else if (err && ((err.error && err.error.code === 403) || err.code === 403)) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.PERMISSION_DENIED : ERROR.PERMISSION_DENIED_LOCAL
    description = ERROR.PERMISSION_DENIED;
  } else if (err && err.code === 429) {
    description = ERROR.RATE_LIMIT;
  } else if (err?.error) {
    console.error(`~~ API ERROR (${err.statusCode || err.error.code})`);
    console.error(err.error);
  }

  if (description) console.error(description);
  process.exit(code);
};

/**
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} deployment The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export function getWebApplicationURL(deployment: Readonly<scriptV1.Schema$Deployment>) {
  const entryPoints = deployment.entryPoints ?? [];
  const webEntryPoint = entryPoints.find(
    (entryPoint: Readonly<scriptV1.Schema$EntryPoint>) => entryPoint.entryPointType === 'WEB_APP'
  );
  if (webEntryPoint) return webEntryPoint.webApp && webEntryPoint.webApp.url;
  logError(null, ERROR.NO_WEBAPP(deployment.deploymentId ?? ''));
  throw new Error('This line should never be executed');
}

/**
 * Gets default project name.
 * @return {string} default project name.
 */
export function getDefaultProjectName(): string {
  return ucfirst(path.basename(process.cwd()));
}

/**
 * Gets the project settings from the project dotfile. Logs errors.
 * ! Should be used instead of `DOTFILE.PROJECT().read()`
 * @param  {boolean} failSilently Don't err when dot file DNE.
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export async function getProjectSettings(failSilently?: boolean): Promise<ProjectSettings> {
  return new Promise<ProjectSettings>(resolve => {
    const fail = (silent?: boolean) => (silent ? resolve() : logError(null, ERROR.SETTINGS_DNE));
    const dotfile = DOTFILE.PROJECT();
    if (dotfile) {
      // Found a dotfile, but does it have the settings, or is it corrupted?
      dotfile
        .read<ProjectSettings>()
        // eslint-disable-next-line promise/prefer-await-to-then
        .then(settings => {
          // Settings must have the script ID. Otherwise we err.
          if (settings.scriptId) {
            resolve(settings);
          } else {
            // TODO: Better error message
            fail(); // Script ID DNE
          }
        })
        .catch(() => {
          fail(failSilently); // Failed to read dotfile
        });
    } else {
      fail(); // Never found a dotfile
    }
  }).catch(error => logError(error));
}

/**
 * Gets the API FileType. Assumes the path is valid.
 * @param  {string} filePath  The file path
 * @return {string}           The API's FileType enum (uppercase), null if not valid.
 */
export function getAPIFileType(filePath: string): string {
  const extension = filePath.slice(filePath.lastIndexOf('.') + 1).toUpperCase();
  return extension === 'GS' || extension === 'JS' ? 'SERVER_JS' : extension;
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function safeIsOnline(): Promise<boolean> {
  // If using a proxy, return true since `isOnline` doesn't work.
  // @see https://github.com/googleapis/google-api-nodejs-client#using-a-proxy
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    return true;
  }

  return isOnline();
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function checkIfOnline() {
  if (await safeIsOnline()) {
    return true;
  }

  logError(null, ERROR.OFFLINE);
  throw new Error('This line should never be executed');
}

/**
 * Saves the project settings in the project dotfile.
 * @param {ProjectSettings} newProjectSettings The project settings
 * @param {boolean} append Appends the settings if true.
 */
export async function saveProject(newProjectSettings: ProjectSettings, append = true): Promise<ProjectSettings> {
  if (append) {
    const projectSettings: ProjectSettings = await getProjectSettings();
    newProjectSettings = {...projectSettings, ...newProjectSettings};
  }

  return DOTFILE.PROJECT().write(newProjectSettings);
}

/**
 * Gets the script's Cloud Platform Project Id from project settings file or prompt for one.
 * @returns {Promise<string>} A promise to get the projectId string.
 */
export async function getProjectId(promptUser = true): Promise<string> {
  try {
    const projectSettings: ProjectSettings = await getProjectSettings();
    if (projectSettings.projectId) return projectSettings.projectId;
    if (!promptUser) throw new Error('Project ID not found.');
    console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(projectSettings.scriptId))}\n`);
    console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
    await projectIdPrompt().then(async answers => {
      projectSettings.projectId = answers.projectId;
      await DOTFILE.PROJECT().write(projectSettings);
    });
    return projectSettings.projectId ?? '';
  } catch (error) {
    logError(null, error.message);
  }

  throw new Error('Project ID not found');
}

/**
 * Handles error of each command.
 */
export function handleError(command: (...args: readonly any[]) => Promise<unknown>) {
  return async (...args: readonly any[]) => {
    try {
      await command(...args);
      if (spinner.isSpinning()) spinner.stop(true);
    } catch (error) {
      spinner.stop(true);
      logError(null, error.message);
    }
  };
}

/**
 * Validate the project id.
 * @param {string} projectId The project id.
 * @returns {boolean} Is the project id valid
 */
export function isValidProjectId(projectId: string) {
  return /^[a-z][-\da-z]{5,29}$/.test(projectId);
}

/**
 * Gets valid JSON obj or throws error.
 * @param value JSON string.
 */
export function getValidJSON<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(ERROR.INVALID_JSON);
  }
}

export const ellipsize = (value: string, length: number) =>
  cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
