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

// This file contains tests for the 'run-function' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import autocomplete from 'inquirer-autocomplete-standalone'; // For mocking prompt

import {Functions} from '../../src/core/functions.js'; // To stub prototype methods
import {useChaiExtensions} from '../helpers.js';
import {
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
  forceInteractiveMode,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Run function command (run)', function () {
  let consoleLogSpy: sinon.SinonSpy;
  let consoleErrorSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    consoleLogSpy = sinon.spy(console, 'log');
    consoleErrorSpy = sinon.spy(console, 'error');
    mockfs({
      '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
      [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
  });

  afterEach(function () {
    consoleLogSpy.restore();
    consoleErrorSpy.restore();
    resetMocks();
    mockfs.restore();
  });

  it('should run function successfully and print response (text)', async function () {
    const functionName = 'myTestFunction';
    const mockResponse = {result: ' ejecución éxitosa'}; // Spanish for "successful execution"
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: mockResponse, error: undefined});

    await runCommand(['run', functionName]);

    expect(runFunctionStub.calledOnceWith(functionName, [], true)).to.be.true;
    expect(consoleLogSpy.calledWith(mockResponse.result)).to.be.true;
    runFunctionStub.restore();
  });

  it('should run function successfully and output JSON response', async function () {
    const functionName = 'myTestFunctionJson';
    const mockResult = {data: 'some result', value: 123};
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: {result: mockResult}, error: undefined});

    const out = await runCommand(['run', functionName, '--json']);

    expect(runFunctionStub.calledOnceWith(functionName, [], true)).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({response: mockResult});
    expect(consoleLogSpy.calledWith(sinon.match.string)).to.be.true; // stdout is captured by runCommand
    runFunctionStub.restore();
  });

  it('should handle API error and print details (text)', async function () {
    const functionName = 'errorFunction';
    const mockError = {
      details: [{errorMessage: 'Test API error', scriptStackTraceElements: [{function: 'sourceFunc', lineNumber: 5}]}],
    };
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: undefined, error: mockError as any});

    await runCommand(['run', functionName]);

    expect(runFunctionStub.calledOnce).to.be.true;
    expect(consoleErrorSpy.calledWith(sinon.match.string, 'Test API error', [{function: 'sourceFunc', lineNumber: 5}])).to.be.true;
    runFunctionStub.restore();
  });

  it('should handle API error and output JSON error', async function () {
    const functionName = 'errorFunctionJson';
     const mockErrorDetails = [{errorMessage: 'Test API error JSON', scriptStackTraceElements: [{function: 'sourceFuncJson', lineNumber: 10}]}];
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: undefined, error: {details: mockErrorDetails} as any});

    const out = await runCommand(['run', functionName, '--json']);

    expect(runFunctionStub.calledOnce).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({error: mockErrorDetails[0]});
    runFunctionStub.restore();
  });

  it('should handle "No response" case (text)', async function () {
    const functionName = 'noResponseFunc';
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: undefined, error: undefined}); // No error, no response

    await runCommand(['run', functionName]);
    expect(runFunctionStub.calledOnce).to.be.true;
    // The command prints a specific message in red using chalk
    // spy will capture the raw message before chalk processes it if chalk is not active in test env,
    // or the chalked string. Checking for substring is safer.
    expect(consoleLogSpy.calledWith(sinon.match(/No response/))).to.be.true;
    runFunctionStub.restore();
  });

  it('should handle "No response" case (JSON)', async function () {
    const functionName = 'noResponseFuncJson';
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: undefined, error: undefined});

    const out = await runCommand(['run', functionName, '--json']);
    expect(runFunctionStub.calledOnce).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({error: 'No response or error details from API.'});
    runFunctionStub.restore();
  });

  it('should handle thrown NOT_FOUND error (JSON)', async function () {
    const functionName = 'notFoundFuncJson';
    const notFoundError = new Error("Function not found");
    (notFoundError as any).cause = { code: 'NOT_FOUND' };
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').rejects(notFoundError);

    const out = await runCommand(['run', functionName, '--json']);
    expect(runFunctionStub.calledOnce).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse.error).to.equal("Function not found");
    // `cause` might not be stringified by default in JSON.stringify(Error)
    // but my command implementation specifically includes `cause` if it exists.
    expect(jsonResponse.cause).to.deep.equal({ code: 'NOT_FOUND' });
    runFunctionStub.restore();
  });

  it('should run with params and devMode=false (nondev) and output JSON', async function () {
    const functionName = 'paramsFuncJson';
    const params = ['param1', {value: 2}];
    const mockResult = 'result with params';
    const runFunctionStub = sinon.stub(Functions.prototype, 'runFunction').resolves({response: {result: mockResult}, error: undefined});

    const out = await runCommand(['run', functionName, '--params', JSON.stringify(params), '--nondev', '--json']);

    expect(runFunctionStub.calledOnceWith(functionName, params, false)).to.be.true; // devMode is false
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({response: mockResult});
    runFunctionStub.restore();
  });

  // Test for interactive function selection could be added but is complex
  // due to inquirer-autocomplete-standalone mocking. For JSON output, the core logic
  // after function name is obtained is more critical.
});
