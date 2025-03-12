import Debug from 'debug';
import {OAuth2Client} from 'google-auth-library';
import {GaxiosError} from 'googleapis-common';
import {SetNonNullable, SetRequired, SetRequiredDeep} from 'type-fest';

const debug = Debug('clasp:core');

export type SetNotEmpty<T, K extends keyof T> = SetNonNullable<SetRequired<T, K>>;

export type FileOptions = {
  projectRootDir: string;
  contentDir: string;
  ignoreFilePath?: string;
  ignorePatterns: string[];
  filePushOrder?: string[];
  fileExtensions: Record<string, string[]>;
};

export type ProjectOptions = {
  scriptId?: string;
  projectId?: string;
  parentId?: string;
};

export type ProjectOptionsWithScript = SetRequired<ProjectOptions, 'scriptId'>;

export type ClaspOptions = {
  credentials?: OAuth2Client;
  configFilePath: string;
  project?: ProjectOptions;
  files: FileOptions;
};

export type ClaspOptionsWithCredentials = SetRequired<ClaspOptions, 'credentials'>;
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

export type ClaspOptionsWithScript = SetRequiredDeep<
  ClaspOptions,
  'configFilePath' | 'project' | 'project.scriptId' | 'files.projectRootDir' | 'files.contentDir'
>;
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

export type ClaspOptionsWithGcpProject = SetRequiredDeep<ClaspOptionsWithScript, 'project.projectId'>;
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
  let pageToken = undefined;
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

export function handleApiError(error: unknown): never {
  debug('Handling API error: %O', error);
  if (!(error instanceof GaxiosError)) {
    throw new Error('Unexpected error', {
      cause: {
        code: 'UNEPECTED_ERROR',
        message: String(error),
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


export function ensureStringArray(value: string | string[]): string[] {
  if (typeof value === 'string') {
    return [value];
  } else if (Array.isArray(value)) {
    // Ensure all elements in the array are strings.
    if (value.every((item) => typeof item === 'string')) {
      return value;
    } else {
      // Handle cases where the array contains non-string elements.
      // You could throw an error, filter out non-strings, or convert them to strings.
      // Example: filter out non-strings
      return value.filter((item) => typeof item === 'string');
    }
  } else {
    // Handle cases where the value is neither a string nor an array of strings.
    // You could throw an error or return an empty array.
    // Example: return an empty array
    return [];
  }
}
