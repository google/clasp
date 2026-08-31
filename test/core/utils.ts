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

// This file contains tests for the shared assertion guards, pagination helper,
// API error handler, and misc utilities in core/utils.ts.

import {expect} from 'chai';
import {GaxiosError} from 'gaxios';
import {describe, it} from 'mocha';
import type {ClaspOptions} from '../../src/core/utils.js';
import {
  assertAuthenticated,
  assertGcpProjectConfigured,
  assertScriptConfigured,
  ensureStringArray,
  fetchWithPages,
  handleApiError,
} from '../../src/core/utils.js';

function baseOptions(): ClaspOptions {
  return {
    configFilePath: '.clasp.json',
    project: {
      scriptId: 'abc123',
      projectId: 'gcp-project',
    },
    files: {
      projectRootDir: '/project',
      contentDir: '/project/src',
      ignorePatterns: [],
      fileExtensions: {},
      skipSubdirectories: false,
    },
  };
}

describe('assertAuthenticated', function () {
  it('does not throw when credentials are present', function () {
    const options = baseOptions();
    options.credentials = {} as ClaspOptions['credentials'];
    expect(() => assertAuthenticated(options)).to.not.throw();
  });

  it('throws with cause.code NO_CREDENTIALS when credentials are missing', function () {
    const options = baseOptions();
    try {
      assertAuthenticated(options);
      expect.fail('expected assertAuthenticated to throw');
    } catch (error) {
      expect((error as Error).cause).to.deep.include({code: 'NO_CREDENTIALS'});
    }
  });
});

describe('assertScriptConfigured', function () {
  it('does not throw when scriptId, projectRootDir, configFilePath, contentDir are all set', function () {
    expect(() => assertScriptConfigured(baseOptions())).to.not.throw();
  });

  it('throws MISSING_SCRIPT_CONFIGURATION when scriptId is missing', function () {
    const options = baseOptions();
    options.project = {};
    try {
      assertScriptConfigured(options);
      expect.fail('expected assertScriptConfigured to throw');
    } catch (error) {
      expect((error as Error).cause).to.deep.include({code: 'MISSING_SCRIPT_CONFIGURATION'});
    }
  });

  it('throws MISSING_SCRIPT_CONFIGURATION when contentDir is missing', function () {
    const options = baseOptions();
    options.files.contentDir = '';
    expect(() => assertScriptConfigured(options)).to.throw();
  });
});

describe('assertGcpProjectConfigured', function () {
  it('does not throw when projectId and script config are all present', function () {
    expect(() => assertGcpProjectConfigured(baseOptions())).to.not.throw();
  });

  it('throws MISSING_PROJECT_ID when projectId is missing but script config is present', function () {
    const options = baseOptions();
    options.project = {scriptId: 'abc123'};
    try {
      assertGcpProjectConfigured(options);
      expect.fail('expected assertGcpProjectConfigured to throw');
    } catch (error) {
      expect((error as Error).cause).to.deep.include({code: 'MISSING_PROJECT_ID'});
    }
  });

  it('throws MISSING_SCRIPT_CONFIGURATION when script config itself is missing', function () {
    const options = baseOptions();
    options.project = {};
    try {
      assertGcpProjectConfigured(options);
      expect.fail('expected assertGcpProjectConfigured to throw');
    } catch (error) {
      expect((error as Error).cause).to.deep.include({code: 'MISSING_SCRIPT_CONFIGURATION'});
    }
  });
});

describe('fetchWithPages', function () {
  it('collects all results across multiple pages', async function () {
    const pages = [
      {results: [1, 2], pageToken: 'page-2'},
      {results: [3], pageToken: undefined},
    ];
    const fn = async () => pages.shift()!;

    const result = await fetchWithPages(fn);
    expect(result).to.deep.equal({results: [1, 2, 3], partialResults: false});
  });

  it('stops early and marks partialResults when maxPages is hit', async function () {
    const fn = async () => ({results: [1], pageToken: 'always-more'});

    const result = await fetchWithPages(fn, {maxPages: 2});
    expect(result.results).to.deep.equal([1, 1]);
    expect(result.partialResults).to.equal(true);
  });

  it('trims results and marks partialResults when maxResults is hit', async function () {
    const fn = async () => ({results: [1, 2, 3], pageToken: undefined});

    const result = await fetchWithPages(fn, {maxResults: 2});
    expect(result.results).to.deep.equal([1, 2]);
    expect(result.partialResults).to.equal(true);
  });

  it('passes the default pageSize to the fetch function', async function () {
    let calledWithPageSize: number | undefined;
    const fn = async (pageSize: number) => {
      calledWithPageSize = pageSize;
      return {results: [], pageToken: undefined};
    };

    await fetchWithPages(fn);
    expect(calledWithPageSize).to.equal(100);
  });
});

describe('handleApiError', function () {
  it('maps a known status code to its clasp error code (404 -> NOT_FOUND)', function () {
    const error = new GaxiosError('Not found', {} as never);
    error.status = 404;

    try {
      handleApiError(error);
      expect.fail('expected handleApiError to throw');
    } catch (thrown) {
      expect((thrown as Error).cause).to.deep.include({code: 'NOT_FOUND'});
    }
  });

  it('falls back to UNEXPECTED_API_ERROR for an unmapped status code', function () {
    const error = new GaxiosError('Server error', {} as never);
    error.status = 500;

    try {
      handleApiError(error);
      expect.fail('expected handleApiError to throw');
    } catch (thrown) {
      expect((thrown as Error).cause).to.deep.include({code: 'UNEXPECTED_API_ERROR'});
    }
  });

  it('uses the first detailed error message when error.errors[] is present', function () {
    const error = new GaxiosError('Generic message', {} as never);
    error.status = 400;
    (error as unknown as {errors: unknown[]}).errors = [{message: 'bad field', domain: 'global', reason: 'invalid'}];

    try {
      handleApiError(error);
      expect.fail('expected handleApiError to throw');
    } catch (thrown) {
      expect((thrown as Error).message).to.equal('bad field');
    }
  });

  it('wraps a non-Gaxios error as UNEXPECTED_ERROR', function () {
    try {
      handleApiError(new Error('boom'));
      expect.fail('expected handleApiError to throw');
    } catch (thrown) {
      expect((thrown as Error).cause).to.deep.include({code: 'UNEXPECTED_ERROR'});
    }
  });
});

describe('ensureStringArray', function () {
  it('wraps a single string in an array', function () {
    expect(ensureStringArray('a')).to.deep.equal(['a']);
  });

  it('returns an array of strings unchanged', function () {
    expect(ensureStringArray(['a', 'b'])).to.deep.equal(['a', 'b']);
  });

  it('filters out non-string elements from a mixed array', function () {
    expect(ensureStringArray(['a', 1, 'b', null] as unknown as string[])).to.deep.equal(['a', 'b']);
  });
});
