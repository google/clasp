import {Spinner} from 'cli-spinner';
import cliTruncate from 'cli-truncate';
import fs from 'fs-extra';
import {script_v1 as scriptV1} from 'googleapis';
import isOnline from 'is-online';
import path from 'path';

import {ClaspError} from './clasp-error';
import {ClaspToken, DOT, DOTFILE, ProjectSettings} from './dotfile';
import {projectIdPrompt} from './inquirer';
import {ERROR, LOG} from './messages';

/**
 * Returns input string with uppercased first character
 */
const capitalize = (value: string) => value && value[0].toUpperCase() + value.slice(1);

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
export const getOAuthSettings = async (local: boolean): Promise<ClaspToken> => {
  const RC = local ? DOTFILE.RC_LOCAL() : DOTFILE.RC;
  try {
    return await RC.read<ClaspToken>();
  } catch (error) {
    throw new ClaspError(getErrorMessage(error) ?? ERROR.NO_CREDENTIALS(local));
  }
};

export const spinner = new Spinner();

/** Stops the spinner if it is spinning */
export const stopSpinner = () => {
  if (spinner.isSpinning()) {
    spinner.stop(true);
  }
};

export const getErrorMessage = (err: any) => {
  let description: string | undefined;
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
    description = `~~ API ERROR (${err.statusCode || err.error.code})=\n${err.error}`;
  }

  return description;
};

/**
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} value The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
export const getWebApplicationURL = (value: Readonly<scriptV1.Schema$Deployment>) => {
  const entryPoint = (value.entryPoints ?? []).find(
    (entryPoint: Readonly<scriptV1.Schema$EntryPoint>) => entryPoint.entryPointType === 'WEB_APP'
  );
  if (entryPoint) {
    return entryPoint.webApp && entryPoint.webApp.url;
  }

  throw new ClaspError(ERROR.NO_WEBAPP(value.deploymentId ?? ''));
};

/**
 * Gets default project name.
 * @return {string} default project name.
 */
export const getDefaultProjectName = (): string => capitalize(path.basename(process.cwd()));

/**
 * Gets the project settings from the project dotfile.
 *
 * Logs errors.
 *
 * ! Should be used instead of `DOTFILE.PROJECT().read()`
 * @param  {boolean} failSilently Don't throw an error when dot file DNE.
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export const getProjectSettings = async (failSilently?: boolean): Promise<ProjectSettings> => {
  try {
    const dotfile = DOTFILE.PROJECT();
    if (dotfile) {
      // Found a dotfile, but does it have the settings, or is it corrupted?
      try {
        const settings = await dotfile.read<ProjectSettings>();

        // Settings must have the script ID. Otherwise we err.
        if (settings.scriptId) {
          return settings;
        }
      } catch {
        if (failSilently) {
          return ({} as unknown) as ProjectSettings;
        }
      }
    }

    throw new ClaspError(ERROR.SETTINGS_DNE); // Never found a dotfile
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(getErrorMessage(error) as string);
  }
};

/**
 * Gets the Google Drive API FileType.
 *
 * Assumes the path is valid.
 * @param  {string} value  The file path
 * @return {string}           The API's FileType enum (uppercase), null if not valid.
 */
export const getApiFileType = (value: string): string => {
  const extension = value.slice(value.lastIndexOf('.') + 1).toUpperCase();

  return ['GS', 'JS'].includes(extension) ? 'SERVER_JS' : extension;
};

/**
 * Checks if the network is available. Gracefully exits if not.
 */
// If using a proxy, return true since `isOnline` doesn't work.
// @see https://github.com/googleapis/google-api-nodejs-client#using-a-proxy
export const safeIsOnline = async (): Promise<boolean> =>
  Boolean(process.env.HTTP_PROXY || process.env.HTTPS_PROXY) || isOnline();

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export const checkIfOnline = async () => {
  if (await safeIsOnline()) {
    return true;
  }

  throw new ClaspError(ERROR.OFFLINE);
};

/**
 * Saves the project settings in the project dotfile.
 * @param {ProjectSettings} projectSettings The project settings
 * @param {boolean} append Appends the settings if true.
 */
export const saveProject = async (projectSettings: ProjectSettings, append = true): Promise<ProjectSettings> =>
  DOTFILE.PROJECT().write(append ? {...(await getProjectSettings()), ...projectSettings} : projectSettings);

/**
 * Gets the script's Cloud Platform Project Id from project settings file or prompt for one.
 * @returns {Promise<string>} A promise to get the projectId string.
 */
export const getProjectId = async (promptUser = true): Promise<string> => {
  try {
    const projectSettings: ProjectSettings = await getProjectSettings();

    if (!projectSettings.projectId) {
      if (!promptUser) {
        throw new ClaspError('Project ID not found.');
      }

      console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(projectSettings.scriptId))}\n`);
      console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);

      projectSettings.projectId = (await projectIdPrompt()).projectId;
      await DOTFILE.PROJECT().write(projectSettings);
    }

    return projectSettings.projectId ?? '';
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(error.message);
  }
};

/**
 * Validates input string is a well-formed project id.
 * @param {string} value The project id.
 * @returns {boolean} Is the project id valid
 */
export const isValidProjectId = (value: string) => /^[a-z][-\da-z]{5,29}$/.test(value);

/**
 * Parses input string into a valid JSON object or throws a `ClaspError` error.
 * @param value JSON string.
 */
export const parseJsonOrDie = <T>(value: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ClaspError(ERROR.INVALID_JSON);
  }
};

/**
 * Pads input string to given length and truncate with ellipsis if necessary
 */
export const ellipsize = (value: string, length: number) =>
  cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
