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
 * @fileoverview This module provides core utility functions and type definitions
 * used throughout the clasp application. It includes helpers for handling
 * configuration options, asserting required settings, managing paginated API
 * responses, and standardizing error handling.
 */

import Debug from 'debug';
import {OAuth2Client} from 'google-auth-library';
import {GaxiosError} from 'googleapis-common';
import {SetNonNullable, SetRequired, SetRequiredDeep} from 'type-fest';

const debug = Debug('clasp:core');

/**
 * Utility type: Makes specified keys K of T non-nullable and required.
 * @template T The base type.
 * @template K The keys to make non-nullable and required.
 */
export type SetNotEmpty<T, K extends keyof T> = SetNonNullable<SetRequired<T, K>>;

/**
 * Options related to file handling within a Clasp project.
 */
export type FileOptions = {
  /** The root directory of the Clasp project (where .clasp.json is typically located). */
  projectRootDir: string;
  /** The directory where Apps Script source files are stored (often called `srcDir` or `rootDir` in .clasp.json). */
  contentDir: string;
  /** Optional path to the .claspignore file. */
  ignoreFilePath?: string;
  /** An array of glob patterns specifying files and directories to ignore. */
  ignorePatterns: string[];
  /** Optional array specifying the order in which files should be pushed to Apps Script. */
  filePushOrder?: string[];
  /** A record mapping Apps Script file types (e.g., 'SERVER_JS', 'HTML') to arrays of local file extensions. */
  fileExtensions: Record<string, string[]>;
  /** If true, subdirectories within the content directory are not processed. */
  skipSubdirectories: boolean;
};

/**
 * Options related to the Apps Script project itself.
 */
export type ProjectOptions = {
  /** The Apps Script project ID. */
  scriptId?: string;
  /** The Google Cloud Platform (GCP) project ID linked to the Apps Script project. */
  projectId?: string;
  /** The ID of the Google Drive file acting as a container for a container-bound script. */
  parentId?: string;
};

/**
 * Utility type: `ProjectOptions` with `scriptId` guaranteed to be defined.
 */
export type ProjectOptionsWithScript = SetRequired<ProjectOptions, 'scriptId'>;

/**
 * Core Clasp configuration options, combining authentication, file, and project settings.
 */
export type ClaspOptions = {
  /** Authenticated OAuth2Client, if available. */
  credentials?: OAuth2Client;
  /** Path to the .clasp.json configuration file. */
  configFilePath: string;
  /** Project-specific options like scriptId, projectId. */
  project?: ProjectOptions;
  /** File handling options. */
  files: FileOptions;
};

/**
 * Utility type: `ClaspOptions` with `credentials` guaranteed to be defined.
 * Used by functions that require authentication.
 */
export type ClaspOptionsWithCredentials = SetRequired<ClaspOptions, 'credentials'>;

/**
 * Asserts that the provided Clasp options include credentials.
 * Throws an error if credentials are not found.
 * This function is a type predicate, narrowing the type of `options` if it doesn't throw.
 * @param options The Clasp options to check.
 */
export function assertAuthenticated(options: ClaspOptions): asserts options is ClaspOptionsWithCredentials {
  if (!options.credentials) {
    debug('Authentication credentials not found in options: %O', options);
    throw new Error('User is not authenticated. Please run "clasp login" first.', {
      cause: {code: 'NO_CREDENTIALS'},
    });
  }
}

/**
 * Utility type: `ClaspOptions` with essential script configuration properties guaranteed to be defined.
 * These include `configFilePath`, `project.scriptId`, `files.projectRootDir`, and `files.contentDir`.
 */
export type ClaspOptionsWithScript = SetRequiredDeep<
  ClaspOptions,
  'configFilePath' | 'project' | 'project.scriptId' | 'files.projectRootDir' | 'files.contentDir'
>;

/**
 * Asserts that the provided Clasp options include essential script configuration.
 * Throws an error if critical settings like scriptId or paths are missing.
 * @param options The Clasp options to check.
 */
export function assertScriptConfigured(options: ClaspOptions): asserts options is ClaspOptionsWithScript {
  if (
    !options.project?.scriptId ||
    !options.files.projectRootDir ||
    !options.configFilePath ||
    !options.files.contentDir
  ) {
    debug('Essential script configuration is missing in options: %O', options);
    throw new Error(
      'Project settings (.clasp.json) not found or script ID is missing. Please run "clasp clone <scriptId>" or "clasp create" in a project directory.',
      {cause: {code: 'MISSING_SCRIPT_CONFIGURATION'}},
    );
  }
}

/**
 * Utility type: `ClaspOptionsWithScript` further refined to guarantee `project.projectId` is defined.
 * Used by functions requiring a linked GCP project.
 */
export type ClaspOptionsWithGcpProject = SetRequiredDeep<ClaspOptionsWithScript, 'project.projectId'>;

/**
 * Asserts that the provided Clasp options include a configured GCP project ID.
 * Throws an error if the `projectId` is missing.
 * @param options The Clasp options to check.
 */
export function assertGcpProjectConfigured(options: ClaspOptions): asserts options is ClaspOptionsWithGcpProject {
  assertScriptConfigured(options); // First, ensure basic script configuration is present.
  if (!options.project?.projectId) {
    debug('GCP project ID not found in script configuration: %O', options.project);
    throw new Error(
      'Google Cloud Platform (GCP) project ID is not set in .clasp.json. Please associate a GCP project via "clasp open-script" settings or set it manually.',
      {cause: {code: 'MISSING_PROJECT_ID'}},
    );
  }
}

/**
 * Options for paginated API requests.
 */
type PageOptions = {
  /** Number of results to fetch per page. */
  pageSize?: number;
  /** Maximum number of pages to fetch. */
  maxPages?: number;
  /** Maximum total number of results to return across all pages. */
  maxResults?: number;
};

/**
 * Represents the result of a paginated fetch operation.
 * @template T The type of the items in the results array.
 */
type Results<T> = {
  /** Array of accumulated results from all fetched pages. */
  results: T[];
  /** True if there were more results available than fetched (due to `maxPages` or `maxResults` limits). */
  partialResults: boolean;
};

/**
 * Represents a single page of results from a paginated API.
 * @template T The type of the items in the results array for this page.
 */
type Page<T> = {
  /** Array of results for the current page. */
  results: T[];
  /** Token to fetch the next page, if available. */
  pageToken?: string;
};

/**
 * Merges provided page options with default values.
 * @param options Optional PageOptions to override defaults.
 * @returns A PageOptions object with all properties guaranteed to be set.
 */
function pageOptionsWithDefaults(options?: PageOptions): Required<PageOptions> {
  return {
    pageSize: 100, // Default page size.
    maxPages: 10,   // Default maximum pages to fetch to prevent excessive calls.
    maxResults: Number.MAX_SAFE_INTEGER, // Default to no limit on total results.
    ...(options ?? {}), // Spread provided options to override defaults.
  };
}

/**
 * Fetches results from a paginated API endpoint.
 * It repeatedly calls the provided function `fn` with page tokens until no more pages are available
 * or limits (`maxPages`, `maxResults`) are reached.
 * @param fn An async function that fetches a single page of results. It receives `pageSize` and `pageToken`.
 * @param options Optional pagination parameters (`pageSize`, `maxPages`, `maxResults`).
 * @returns A promise that resolves to a `Results` object containing all fetched items and a `partialResults` flag.
 * @template T The type of the items being fetched.
 */
export async function fetchWithPages<T>(
  fn: (pageSize: number, pageToken: string | undefined) => Promise<Page<T>>,
  options?: PageOptions,
): Promise<Results<T>> {
  const {pageSize, maxPages, maxResults} = pageOptionsWithDefaults(options);
  let currentPageToken: string | undefined;
  let fetchedPageCount = 0;
  const accumulatedResults: T[] = [];

  do {
    debug(`Fetching page ${fetchedPageCount + 1} with token: ${currentPageToken ?? ' (initial)'}`);
    const pageData = await fn(pageSize, currentPageToken);
    if (pageData.results) {
      accumulatedResults.push(...pageData.results);
    }
    fetchedPageCount++;
    currentPageToken = pageData.pageToken;
  } while (currentPageToken && fetchedPageCount < maxPages && accumulatedResults.length < maxResults);

  let partialResults = currentPageToken !== undefined;
  if (accumulatedResults.length > maxResults) {
    debug(`Trimming results from ${accumulatedResults.length} to meet maxResults limit of ${maxResults}.`);
    // Return only up to maxResults, and indicate results are partial due to this trim.
    return {
      results: accumulatedResults.slice(0, maxResults),
      partialResults: true,
    };
  }

  if (partialResults) {
    debug('Partial results returned: either page limit reached or more data available.');
  }

  return {
    results: accumulatedResults,
    partialResults,
  };
}

/**
 * Type definition for the detailed error structure often found in GaxiosError responses from Google APIs.
 */
type DetailedGaxiosError = {
  errors: Array<{
    message: string;
    domain?: string; // Optional as not always present
    reason?: string;  // Optional as not always present
  }>;
};

/**
 * Type guard to check if an error object is a GaxiosError containing detailed error information.
 * @param error The error object to check.
 * @returns True if the error is a GaxiosError with a non-empty `errors` array, false otherwise.
 */
function isDetailedError(error: unknown): error is GaxiosError & DetailedGaxiosError {
  if (!error || !(error instanceof GaxiosError)) {
    return false;
  }
  // Type assertion to access potential 'errors' property.
  const detailedError = error as GaxiosError & Partial<DetailedGaxiosError>;
  return Array.isArray(detailedError.errors) && detailedError.errors.length > 0;
}

/**
 * Maps common HTTP status codes from Google APIs to standardized clasp error codes.
 */
const ERROR_CODES: Record<number, string> = {
  400: 'INVALID_ARGUMENT',   // Bad Request
  401: 'NOT_AUTHENTICATED',  // Unauthorized (often means login required)
  403: 'NOT_AUTHORIZED',     // Forbidden (user lacks permission for the action)
  404: 'NOT_FOUND',          // Not Found
  // Other codes could be added here, e.g., 429 for rate limits, 500 for server errors.
};

/**
 * Standardized error handler for GaxiosErrors from Google API calls.
 * It extracts a meaningful message and error code, then re-throws a new Error
 * with the original error attached as `cause`.
 * @param error The error object, expected to be a GaxiosError.
 * @returns This function never returns normally; it always throws an error.
 * @throws An Error with a structured `cause` property containing the original error and parsed details.
 */
export function handleApiError(error: unknown): never {
  debug('Handling API error: %O', error);

  if (!(error instanceof GaxiosError)) {
    // If it's not a GaxiosError, wrap it but indicate it's unexpected.
    throw new Error(`An unexpected error occurred: ${String(error)}`, {
      cause: {code: 'UNEXPECTED_ERROR', originalError: error},
    });
  }

  // Extract status and potentially more detailed messages from GaxiosError.
  const status = error.response?.status ?? 0;
  let message = error.message; // Default to the GaxiosError message.

  if (isDetailedError(error) && error.errors[0].message) {
    // Prefer the first detailed error message if available.
    message = error.errors[0].message;
  }

  const errorCode = ERROR_CODES[status] ?? 'UNEXPECTED_API_ERROR';

  throw new Error(message, {
    cause: {
      code: errorCode,
      originalMessage: error.message, // Keep original Gaxios message too
      status, // HTTP status
      gaxiosError: error, // Attach the full original GaxiosError
    },
  });
}

/**
 * Ensures that the input value is an array of strings.
 * If the input is a single string, it's wrapped in an array.
 * If the input is already an array, it filters out any non-string elements.
 * If the input is neither, an empty array is returned.
 * @param value The value to process.
 * @returns An array of strings.
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
