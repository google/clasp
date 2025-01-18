import cliTruncate from 'cli-truncate';
import {script_v1 as scriptV1} from 'googleapis';
import inquirer from 'inquirer';
import isReachable from 'is-reachable';
import logSymbols from 'log-symbols';
import ora from 'ora';
import pMap from 'p-map';

import {ClaspError} from './clasp-error.js';
import {DOTFILE} from './dotfile.js';
import {ERROR, LOG} from './messages.js';

import type {ProjectSettings} from './dotfile.js';

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

export const spinner = ora(); // new Spinner();

/** Stops the spinner if it is spinning */
export function stopSpinner() {
  if (spinner.isSpinning) {
    spinner.stop();
  }
}

type ResponseLike = {
  error?: {
    code: number;
    message: string;
    status: string;
  };
};

function normalizeError(value: unknown): ResponseLike {
  // TODO - Restore legacy behavior if needed
  return value as ResponseLike;
}

export function getErrorMessage(value: ResponseLike) {
  value = normalizeError(value);
  if (!value?.error) {
    return undefined;
  }
  if (value.error.code === 401) {
    return ERROR.UNAUTHENTICATED;
  }
  if (value.error.code === 403) {
    return ERROR.PERMISSION_DENIED;
  }
  if (value.error.code === 429) {
    return ERROR.RATE_LIMIT;
  }
  return undefined;
}

/**
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} value The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
export function getWebApplicationURL(value: Readonly<scriptV1.Schema$Deployment>) {
  const {entryPoints = []} = value;
  const entryPoint = entryPoints.find(
    (entryPoint: Readonly<scriptV1.Schema$EntryPoint>) => entryPoint.entryPointType === 'WEB_APP',
  );
  if (entryPoint) {
    return entryPoint.webApp?.url;
  }

  throw new ClaspError(ERROR.NO_WEBAPP(value.deploymentId ?? ''));
}

/**
 * Gets the project settings from the project dotfile.
 *
 * Logs errors.
 *
 * ! Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export async function getProjectSettings(): Promise<ProjectSettings> {
  const dotfile = DOTFILE.PROJECT();

  if (!(await dotfile.exists())) {
    throw new ClaspError(ERROR.SETTINGS_DNE()); // Never found a dotfile
  }

  const settings = await dotfile.read<ProjectSettings>();

  // Settings must have the script ID. Otherwise we err.
  if (!settings.scriptId) {
    throw new ClaspError(ERROR.SETTINGS_DNE()); // Never found a dotfile
  }
  return settings;
}

/**
 * Gets the Google Drive API FileType.
 *
 * Assumes the path is valid.
 * @param  {string} value  The file path
 * @return {string}           The API's FileType enum (uppercase), null if not valid.
 */
export function getApiFileType(value: string): string {
  const extension = value.slice(value.lastIndexOf('.') + 1).toUpperCase();

  return ['GS', 'JS'].includes(extension) ? 'SERVER_JS' : extension;
}

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
export async function safeIsOnline(): Promise<boolean> {
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
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function checkIfOnlineOrDie() {
  if (await safeIsOnline()) {
    return true;
  }

  throw new ClaspError(ERROR.OFFLINE);
}

/**
 * Saves the project settings in the project dotfile.
 * @param {ProjectSettings} projectSettings The project settings
 * @param {boolean} append Appends the settings if true.
 */
export async function saveProject(projectSettings: ProjectSettings, append = true): Promise<ProjectSettings> {
  return DOTFILE.PROJECT().write(append ? {...(await getProjectSettings()), ...projectSettings} : projectSettings);
}

/**
 * Gets the script's Cloud Platform Project Id from project settings file or prompt for one.
 * @returns {Promise<string>} A promise to get the projectId string.
 */
export async function getProjectId(promptUser = true): Promise<string> {
  try {
    const projectSettings: ProjectSettings = await getProjectSettings();

    if (!projectSettings.projectId) {
      if (!promptUser) {
        throw new ClaspError('Project ID not found.');
      }

      console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(projectSettings.scriptId))}\n`);
      console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);

      const answer = await inquirer.prompt([
        {
          message: `${LOG.ASK_PROJECT_ID}`,
          name: 'projectId',
          type: 'input',
        },
      ]);
      projectSettings.projectId = answer.projectId;
      await DOTFILE.PROJECT().write(projectSettings);
    }

    return projectSettings.projectId ?? '';
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }
    throw new ClaspError('Unable to fetch project ID', 1);
  }
}

/**
 * Validates input string is a well-formed project id.
 * @param {string} value The project id.
 * @returns {boolean} Is the project id valid
 */
export function isValidProjectId(value: string) {
  return /^[a-z][-\da-z]{5,29}$/.test(value);
}

/**
 * Parses input string into a valid JSON object or throws a `ClaspError` error.
 * @param value JSON string.
 */
export function parseJsonOrDie<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ClaspError(ERROR.INVALID_JSON);
  }
}

/**
 * Pads input string to given length and truncate with ellipsis if necessary
 */
export function ellipsize(value: string, length: number) {
  return cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
} /**
 * Gets the project ID from the manifest. If there is no project ID, it returns an error.
 */

export async function getProjectIdOrDie(): Promise<string> {
  const projectId = await getProjectId(); // Will prompt user to set up if required
  if (projectId) {
    return projectId;
  }

  throw new ClaspError(ERROR.NO_GCLOUD_PROJECT());
}
