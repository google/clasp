import cliTruncate from 'cli-truncate';
import fs from 'fs-extra';
import {script_v1 as scriptV1} from 'googleapis';
import isReachable from 'is-reachable';
import logSymbols from 'log-symbols';
import ora from 'ora';
import path from 'path';
import pMap from 'p-map';

import {ClaspError} from './clasp-error.js';
import {Conf} from './conf.js';
import {DOTFILE} from './dotfile.js';
import {projectIdPrompt} from './inquirer.js';
import {ERROR, LOG} from './messages.js';

import type {ClaspToken, ProjectSettings} from './dotfile';

const config = Conf.get();

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
export const hasOauthClientSettings = (local = false): boolean => {
  if (local) {
    return config.authLocal !== undefined && fs.existsSync(config.authLocal);
  }
  return config.auth !== undefined && fs.existsSync(config.auth);
};

/**
 * Gets the OAuth client settings from rc file.
 * @param {boolean} local If true, gets the local OAuth settings. Global otherwise.
 * ! Should be used instead of `DOTFILE.RC?().read()`
 * @returns {Promise<ClaspToken>} A promise to get the rc file as object.
 */
export const getOAuthSettings = async (local: boolean): Promise<ClaspToken> => {
  try {
    const result = DOTFILE.AUTH(local).read<ClaspToken>();
    return await result;
  } catch (error) {
    throw new ClaspError(getErrorMessage(error) ?? ERROR.NO_CREDENTIALS(local));
  }
};

export const spinner = ora(); // new Spinner();

/** Stops the spinner if it is spinning */
export const stopSpinner = () => {
  if (spinner.isSpinning) {
    spinner.stop();
  }
};

export const getErrorMessage = (value: any) => {
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (value && typeof value.error === 'string') {
    return JSON.parse(value.error).error;
  }

  if (value?.statusCode === 401 || (value?.error && value.error.error && value.error.error.code === 401)) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.UNAUTHENTICATED : ERROR.UNAUTHENTICATED_LOCAL
    return ERROR.UNAUTHENTICATED;
  }

  if (value && ((value.error && value.error.code === 403) || value.code === 403)) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.PERMISSION_DENIED : ERROR.PERMISSION_DENIED_LOCAL
    return ERROR.PERMISSION_DENIED;
  }

  if (value && value.code === 429) {
    return ERROR.RATE_LIMIT;
  }

  if (value?.error) {
    return `~~ API ERROR (${value.statusCode || value.error.code})=\n${value.error}`;
  }

  return undefined;
};

/**
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} value The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
export const getWebApplicationURL = (value: Readonly<scriptV1.Schema$Deployment>) => {
  const {entryPoints = []} = value;
  const entryPoint = entryPoints.find(
    (entryPoint: Readonly<scriptV1.Schema$EntryPoint>) => entryPoint.entryPointType === 'WEB_APP'
  );
  if (entryPoint) {
    return entryPoint.webApp?.url;
  }

  throw new ClaspError(ERROR.NO_WEBAPP(value.deploymentId ?? ''));
};

/**
 * Gets default project name.
 * @return {string} default project name.
 */
export const getDefaultProjectName = (): string => capitalize(path.basename(config.projectRootDirectory!));

/**
 * Gets the project settings from the project dotfile.
 *
 * Logs errors.
 *
 * ! Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export const getProjectSettings = async (): Promise<ProjectSettings> => {
  const dotfile = DOTFILE.PROJECT();

  try {
    if (await dotfile.exists()) {
      // Found a dotfile, but does it have the settings, or is it corrupted?
      try {
        const settings = await dotfile.read<ProjectSettings>();

        // Settings must have the script ID. Otherwise we err.
        if (settings.scriptId) {
          return settings;
        }
      } catch (error) {
        throw new ClaspError(ERROR.SETTINGS_DNE()); // Never found a dotfile
      }
    }

    throw new ClaspError(ERROR.SETTINGS_DNE()); // Never found a dotfile
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

const mapper = async (url: string) => {
  const wasReached = await isReachable(url, {timeout: 25_000});
  if (!wasReached) {
    console.log(url, logSymbols.error);
  }
  return wasReached;
};

/**
 * Checks if the network is available. Gracefully exits if not.
 */
// If using a proxy, return true since `isOnline` doesn't work.
// @see https://github.com/googleapis/google-api-nodejs-client#using-a-proxy
export const safeIsOnline = async (): Promise<boolean> => {
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    return true;
  }

  const urls = [
    // 'www.googleapis.com',
    'script.google.com',
    'console.developers.google.com',
    'console.cloud.google.com',
    'drive.google.com',
  ];

  const result = await pMap(urls, mapper, {stopOnError: false});

  return result.every(wasReached => wasReached);
};

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export const checkIfOnlineOrDie = async () => {
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

    // TODO: better error handling
    throw new ClaspError((error as any).message);
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
