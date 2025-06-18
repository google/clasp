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

// This file provides utility types, assertion functions, and helper functions
// (like for API pagination and error handling) used across the core modules
// of clasp.

import Debug from 'debug';
import {OAuth2Client} from 'google-auth-library';
import {GaxiosError} from 'googleapis-common';
import {SetNonNullable, SetRequired, SetRequiredDeep} from 'type-fest';

const debug = Debug('clasp:core');

/**
 * Utility type from 'type-fest' to make specified keys K of T non-nullable and required.
 * @template T - The base type.
 * @template K - The keys to make non-nullable and required.
 */
export type SetNotEmpty<T, K extends keyof T> = SetNonNullable<SetRequired<T, K>>;

/**
 * Defines options related to file management for a clasp project.
 * @property {string} projectRootDir - The root directory of the clasp project.
 * @property {string} contentDir - The directory containing the script source files, relative to projectRootDir.
 * @property {string} [ignoreFilePath] - Path to the .claspignore file.
 * @property {string[]} ignorePatterns - An array of glob patterns for files/directories to ignore.
 * @property {string[]} [filePushOrder] - An optional array specifying the order in which files should be pushed.
 * @property {Record<string, string[]>} fileExtensions - A map of Apps Script file types (e.g., "SERVER_JS", "HTML") to their corresponding local file extensions (e.g., [".js", ".gs"]).
 * @property {boolean} skipSubdirectories - If true, files in subdirectories of contentDir are not processed.
 */
export type FileOptions = {
  projectRootDir: string;
  contentDir: string;
  ignoreFilePath?: string;
  ignorePatterns: string[];
  filePushOrder?: string[];
  fileExtensions: Record<string, string[]>;
  skipSubdirectories: boolean;
};

/**
 * Defines options related to the Apps Script project itself.
 * @property {string} [scriptId] - The ID of the Apps Script project.
 * @property {string} [projectId] - The Google Cloud Platform (GCP) project ID linked to the Apps Script project.
 * @property {string} [parentId] - The ID of the Google Drive folder or file that is the parent of a container-bound script.
 */
export type ProjectOptions = {
  scriptId?: string;
  projectId?: string;
  parentId?: string;
};

/**
 * Utility type that makes the `scriptId` property of `ProjectOptions` required.
 */
export type ProjectOptionsWithScript = SetRequired<ProjectOptions, 'scriptId'>;

/**
 * Defines the overall configuration options for a Clasp instance.
 * @property {OAuth2Client} [credentials] - The OAuth2 client used for authentication.
 * @property {string} configFilePath - Path to the .clasp.json configuration file.
 * @property {ProjectOptions} [project] - Options related to the Apps Script project.
 * @property {FileOptions} files - Options related to file management.
 */
export type ClaspOptions = {
  credentials?: OAuth2Client;
  configFilePath: string;
  project?: ProjectOptions;
  files: FileOptions;
};

/**
 * Utility type that makes the `credentials` property of `ClaspOptions` required.
 */
export type ClaspOptionsWithCredentials = SetRequired<ClaspOptions, 'credentials'>;

/**
 * Asserts that the provided ClaspOptions include credentials.
 * Throws an error if credentials are not set. This also acts as a type guard.
 * @param {ClaspOptions} options - The Clasp options to check.
 * @throws {Error} If `options.credentials` is not set.
 */
export function assertAuthenticated(options: ClaspOptions): asserts options is ClaspOptionsWithCredentials {
  if (!options.credentials) {
    debug('Credentials not set in options: %O', options);
    throw new Error('No credentials found.', {
      cause: {
        code: 'NO_CREDENTIALS',
      },
    });
  }
}

/**
 * Utility type that makes specific project and file configuration properties within `ClaspOptions` required.
 * Ensures `configFilePath`, `project`, `project.scriptId`, `files.projectRootDir`, and `files.contentDir` are set.
 */
export type ClaspOptionsWithScript = SetRequiredDeep<
  ClaspOptions,
  'configFilePath' | 'project' | 'project.scriptId' | 'files.projectRootDir' | 'files.contentDir'
>;

/**
 * Asserts that the provided ClaspOptions include essential script project configurations.
 * Throws an error if `scriptId`, `projectRootDir`, `configFilePath`, or `contentDir` are missing.
 * This also acts as a type guard.
 * @param {ClaspOptions} options - The Clasp options to check.
 * @throws {Error} If essential script configurations are missing.
 */
export function assertScriptConfigured(options: ClaspOptions): asserts options is ClaspOptionsWithScript {
  if (
    !options.project?.scriptId ||
    !options.files.projectRootDir ||
    !options.configFilePath ||
    !options.files.contentDir
  ) {
    debug('Script configuration not found in options: %O', options);
    throw new Error('Project settings not found.', {
      cause: {
        code: 'MISSING_SCRIPT_CONFIGURATION',
      },
    });
  }
}

/**
 * Utility type that extends `ClaspOptionsWithScript` to also require `project.projectId`.
 */
export type ClaspOptionsWithGcpProject = SetRequiredDeep<ClaspOptionsWithScript, 'project.projectId'>;

/**
 * Asserts that the provided ClaspOptions include a GCP project ID, in addition to base script configurations.
 * Throws an error if `projectId` is missing. This also acts as a type guard.
 * @param {ClaspOptions} options - The Clasp options to check.
 * @throws {Error} If `options.project.projectId` is not set.
 */
export function assertGcpProjectConfigured(options: ClaspOptions): asserts options is ClaspOptionsWithGcpProject {
  assertScriptConfigured(options);
  if (!options.project?.projectId) {
    debug('Script configuration not found in options: %O', options);
    throw new Error('Project ID not found.', {
      cause: {
        code: 'MISSING_PROJECT_ID',
      },
    });
  }
}
type PageOptions = {
  pageSize?: number;
  maxPages?: number;
  maxResults?: number;
};

type Results<T> = {
  results: T[];
  partialResults: boolean;
};

type Page<T> = {
  results: T[];
  pageToken?: string;
};

function pageOptionsWithDefaults(options?: PageOptions): Required<PageOptions> {
  return {
    pageSize: 100,
    maxPages: 10,
    maxResults: Number.MAX_SAFE_INTEGER,
    ...(options ?? {}),
  };
}

export async function fetchWithPages<T>(
  fn: (pageSize: number, pageToken: string | undefined) => Promise<Page<T>>,
  options?: PageOptions,
): Promise<Results<T>> {
  const {pageSize, maxPages, maxResults} = pageOptionsWithDefaults(options);
  let pageToken: string | undefined = undefined;
  let pageCount = 0;

  const results: Array<T> = [];

  do {
    debug('Fetching page %d', pageCount + 1);
    const page = await fn(pageSize, pageToken);
    if (page.results) {
      results.push(...page.results);
    }
    ++pageCount;
    pageToken = page.pageToken;
  } while (pageToken && pageCount < maxPages && results.length < maxResults);

  if (pageToken) {
    debug('Returning partial results, page limit exceeded');
  }

  if (results.length > maxResults) {
    debug('Trimming results to %d', maxResults);
    return {
      results: results.slice(0, maxResults),
      partialResults: true,
    };
  }

  return {
    results,
    partialResults: pageToken !== undefined,
  };
}

type DetailedGaxiosError = {
  errors: Array<{
    message: string;
    domain: string;
    reason: string;
  }>;
};

/**
 * Checks if an error object is a GaxiosError with detailed error information.
 * @param {unknown} error - The error object to check.
 * @returns {boolean} True if the error is a GaxiosError with details, false otherwise.
 */
function isDetailedError(error: unknown): error is GaxiosError & DetailedGaxiosError {
  if (!error) {
    return false;
  }
  const detailedError = error as DetailedGaxiosError;
  if (detailedError.errors === undefined) {
    return false;
  }
  if (detailedError.errors.length === 0) {
    return false;
  }
  return true;
}

const ERROR_CODES: Record<number, string> = {
  400: 'INVALID_ARGUMENT',
  401: 'NOT_AUTHENTICATED',
  403: 'NOT_AUTHORIZED',
  404: 'NOT_FOUND',
};

/**
 * Standardized error handler for Google API errors (GaxiosError).
 * It extracts a meaningful message and error code, then re-throws a new error.
 * @param {unknown} error - The error received from a Google API call.
 * @throws {Error} A new error with a structured cause including the original error,
 * a clasp-specific error code, and the message.
 */
export function handleApiError(error: unknown): never {
  debug('Handling API error: %O', error);
  if (!(error instanceof GaxiosError)) {
    throw new Error('Unexpected error', {
      cause: {
        code: 'UNEXPECTED_ERROR',
        message: new String(error),
        error: error,
      },
    });
  }
  const status = error.status;
  let message = error.message;
  if (isDetailedError(error)) {
    message = error.errors[0].message;
  }
  const code = ERROR_CODES[status ?? 0] ?? 'UNEXPECTED_API_ERROR';
  throw new Error(message, {
    cause: {
      code: code,
      message: message,
      error: error,
    },
  });
}

/**
 * Ensures that a value is an array of strings.
 * If the input is a single string, it's wrapped in an array.
 * If it's already an array of strings, it's returned as is.
 * If it's an array containing non-string elements, those elements are filtered out.
 * If the input is neither a string nor an array, an empty array is returned.
 * @param {string | string[]} value - The value to process.
 * @returns {string[]} An array of strings.
 */
export function ensureStringArray(value: string | string[]): string[] {
  if (typeof value === 'string') {
    return [value];
  } else if (Array.isArray(value)) {
    // Ensure all elements in the array are strings.
    if (value.every(item => typeof item === 'string')) {
      return value;
    } else {
      // Handle cases where the array contains non-string elements.
      // You could throw an error, filter out non-strings, or convert them to strings.
      // Example: filter out non-strings
      return value.filter(item => typeof item === 'string');
    }
  } else {
    // Handle cases where the value is neither a string nor an array of strings.
    // You could throw an error or return an empty array.
    // Example: return an empty array
    return [];
  }
}
