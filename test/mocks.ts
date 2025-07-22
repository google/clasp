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

// This file provides mock implementations and setup/teardown functions for
// testing clasp. It uses `nock` to mock HTTP requests to Google APIs and
// `mock-fs` to simulate file system interactions, enabling isolated and
// deterministic tests.

import {expect} from 'chai';
import mockfs from 'mock-fs';
import nock from 'nock';
import sinon from 'sinon';
import {claspEnv} from '../src/commands/utils.js';

/**
 * Forces or disables the interactive mode for tests by setting the `claspEnv.isInteractive` flag.
 * @param {boolean} value - True to force interactive mode, false to disable it.
 */
export function forceInteractiveMode(value: boolean) {
  claspEnv.isInteractive = value;
}

/**
 * Sets up the basic mocking environment for tests.
 * Disables real network connections using `nock`, initializes a mock filesystem with `mockfs`,
 * and sets `claspEnv.isBrowserPresent` to false.
 */
export function setupMocks() {
  nock.disableNetConnect();
  mockfs({});
  claspEnv.isBrowserPresent = false;
}

/**
 * Resets all mocks to their original state after a test.
 * Restores the filesystem, cleans all `nock` interceptors, re-enables net connections,
 * restores `sinon` stubs/spies, and resets `claspEnv` flags to their default TTY-based values.
 */
export function resetMocks() {
  mockfs.restore();
  nock.cleanAll();
  nock.enableNetConnect();
  sinon.restore();
  claspEnv.isInteractive = process.stdout.isTTY;
  claspEnv.isBrowserPresent = process.stdout.isTTY;
}

/**
 * Mocks a successful OAuth token refresh request to `https://oauth2.googleapis.com/token`.
 */
export function mockOAuthRefreshRequest() {
  nock('https://oauth2.googleapis.com').post(/token/).reply(200, {
    access_token: 'not-a-token',
    expiors_in: 3600,
  });
}

/**
 * Mocks a successful script content download from the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to mock.
 * @param {number} [options.version] - Optional version number to include in the request query.
 * @param {Array<{name: string; type: string; source: string}>} [options.files] -
 *   The array of file objects to return in the mock response. Defaults to a standard set
 *   of 'appsscript.json' and 'Code.js'.
 */
export function mockScriptDownload({
  scriptId = 'mock-script-id',
  version,
  files = [
    {
      name: 'appsscript',
      type: 'JSON',
      source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
    },
    {
      name: 'Code',
      type: 'SERVER_JS',
      source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
    },
  ],
}: {
  scriptId: string;
  version?: number;
  files?: Array<{name: string; type: string; source: string}>;
}) {
  const query = version ? {versionNumber: version} : {};
  nock('https://script.googleapis.com').get(`/v1/projects/${scriptId}/content`).query(query).reply(200, {
    scriptId,
    files,
  });
}

/**
 * Mocks a failed script content download from the Google Apps Script API.
 * @param {object} options - Options for the mock error.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID for which the download fails.
 * @param {number} [options.statusCode=400] - The HTTP status code for the error response.
 * @param {any} [options.body] - The response body for the error. Defaults to a generic error structure.
 */
export function mockScriptDownloadError({
  scriptId = 'mock-script-id',
  statusCode = 400,
  body = {
    error: {
      errors: [
        {
          message: 'Mock error',
        },
      ],
    },
  },
}: {
  scriptId?: string;
  statusCode?: number;
  body?: any;
}) {
  nock('https://script.googleapis.com').get(`/v1/projects/${scriptId}/content`).reply(statusCode, body);
}

/**
 * Mocks a successful listing of script files from the Google Drive API.
 * Returns a predefined list of three script files.
 */
export function mockListScripts() {
  nock('https://www.googleapis.com')
    .get('/drive/v3/files')
    .query(true)
    .reply(200, {
      files: [
        {
          id: 'id1',
          name: 'script 1',
        },
        {
          id: 'id2',
          name: 'script 2',
        },
        {
          id: 'id3',
          name: 'script 3',
        },
      ],
    });
}

/**
 * Mocks a successful listing of script versions from the Google Apps Script API.
 * Returns a predefined list of two versions for the given script ID.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID for which to mock versions.
 */
export function mockListVersions({scriptId = 'mock-script-id'}: {scriptId?: string}) {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/versions`)
    .query(true)
    .reply(200, {
      versions: [
        {
          scriptId,
          versionNumber: 1,
          description: 'Test version 1',
          createTime: new Date().toISOString(),
        },
        {
          scriptId,
          versionNumber: 2,
          description: 'Test version 2',
          createTime: new Date().toISOString(),
        },
      ],
    });
}

/**
 * Mocks a successful script creation call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to be returned.
 * @param {string} [options.title=''] - The expected title in the request body.
 * @param {string} [options.parentId] - The expected parent ID in the request body.
 */
export function mockCreateScript({
  scriptId = 'mock-script-id',
  title = '',
  parentId,
}: {
  scriptId?: string;
  title?: string;
  parentId?: string;
}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects`, body => {
      expect(body.title).to.equal(title);
      return true;
    })
    .reply(200, {
      scriptId,
      title,
      parentId,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      // creator
      // lastModifyUser
    });
}

/**
 * Mocks the creation of a container-bound script.
 * This involves two API calls: one to Google Drive API to create the container,
 * and one to Google Apps Script API to create the script bound to it.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to be returned for the Apps Script project.
 * @param {string} [options.title='Bound script'] - The title for both the Drive file and the Apps Script project.
 * @param {string} [options.mimeType='application/vnd.google-apps.spreadsheet'] - The MIME type of the Drive container.
 * @param {string} [options.parentId='mock-file-id'] - The ID to be returned for the created Drive file.
 */
export function mockCreateBoundScript({
  scriptId = 'mock-script-id',
  title = 'Bound script',
  mimeType = 'application/vnd.google-apps.spreadsheet',
  parentId = 'mock-file-id',
}: {
  scriptId?: string;
  title?: string;
  mimeType?: string;
  parentId?: string;
}) {
  nock('https://www.googleapis.com')
    .post('/drive/v3/files', body => {
      expect(body.name).to.equal(title);
      expect(body.mimeType).to.equal(mimeType);
      return true;
    })
    .reply(200, {
      id: parentId,
    });

  nock('https://script.googleapis.com')
    .post('/v1/projects', body => {
      expect(body.title).to.equal('test sheet');
      expect(body.parentId).to.equal(parentId);
      return true;
    })
    .reply(200, {
      scriptId: scriptId,
      parentId: parentId,
      title,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    });
}

/**
 * Mocks a successful script version creation call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID for which the version is created.
 * @param {string} [options.description=''] - The expected description in the request body.
 * @param {number} [options.version=1] - The version number to be returned.
 */
export function mockCreateVersion({
  scriptId = 'mock-script-id',
  description = '',
  version = 1,
}: {
  scriptId?: string;
  description?: string;
  version?: number | undefined;
}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/versions`, body => {
      expect(body.description).to.equal(description);
      return true;
    })
    .reply(200, {
      scriptId,
      versionNumber: version ?? 1,
      description: description ?? 'Auto-generated description',
      createTime: new Date().toISOString(),
    });
}

/**
 * Mocks a successful script deployment creation call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID for the deployment.
 * @param {string} [options.description=''] - The expected description in the request body.
 * @param {number} [options.version=1] - The expected version number in the request body.
 */
export function mockCreateDeployment({
  scriptId = 'mock-script-id',
  description = '',
  version = 1,
}: {
  scriptId?: string;
  description?: string;
  version?: number;
}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/deployments`, body => {
      expect(body.description).to.equal(description);
      expect(body.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId: 'mock-deployment-id',
      deploymentConfig: {
        scriptId,
        versionNumber: version,
        manifestFileName: 'appsscript',
        description,
      },
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

/**
 * Mocks a successful script deployment update call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID of the deployment.
 * @param {string} [options.deploymentId='mock-deployment-id'] - The ID of the deployment to update.
 * @param {string} [options.description=''] - The expected description in the request body.
 * @param {number} [options.version=1] - The expected version number in the request body.
 */
export function mockUpdateDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
  description = '',
  version = 1,
}: {
  scriptId?: string;
  deploymentId?: string;
  description?: string;
  version?: number;
}) {
  nock('https://script.googleapis.com')
    .put(`/v1/projects/${scriptId}/deployments/${deploymentId}`, body => {
      expect(body.deploymentConfig.description).to.equal(description);
      expect(body.deploymentConfig.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId,
      deploymentConfig: {
        scriptId,
        versionNumber: version,
        manifestFileName: 'appsscript',
        description,
      },
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

/**
 * Mocks a successful script deployment deletion call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID of the deployment.
 * @param {string} [options.deploymentId='mock-deployment-id'] - The ID of the deployment to delete.
 */
export function mockDeleteDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
}: {
  scriptId?: string;
  deploymentId?: string;
}) {
  nock('https://script.googleapis.com').delete(`/v1/projects/${scriptId}/deployments/${deploymentId}`).reply(200, {});
}

/**
 * Mocks a successful listing of script deployments from the Google Apps Script API.
 * Returns a predefined list of deployments for the given script ID.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID for which to list deployments.
 */
export function mockListDeployments({scriptId = 'mock-script-id'}: {scriptId?: string}) {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/deployments`)
    .query(true)
    .reply(200, {
      deployments: [
        {
          deploymentId: 'head-deployment-id',
          deploymentConfig: {
            scriptId,
            manifestFileName: 'appsscript',
            description: 'Head deployment',
          },
        },
        {
          deploymentId: 'mock-deployment-id',
          deploymentConfig: {
            scriptId,
            versionNumber: 1,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        },
        {
          deploymentId: 'mock-deployment-id-2',
          deploymentConfig: {
            scriptId,
            versionNumber: 2,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        },
      ],
    });
}

/**
 * Mocks a successful service disabling call to the Google Service Usage API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.projectId='mock-project-id'] - The GCP project ID.
 * @param {string} options.serviceName - The name of the service to disable (e.g., 'sheets.googleapis.com').
 */
export function mockDisableService({
  projectId = 'mock-project-id',
  serviceName,
}: {
  projectId?: string;
  serviceName: string;
}) {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:disable`)
    .reply(200, {});
}

/**
 * Mocks a successful service enabling call to the Google Service Usage API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.projectId='mock-project-id'] - The GCP project ID.
 * @param {string} options.serviceName - The name of the service to enable (e.g., 'sheets.googleapis.com').
 */
export function mockEnableService({
  projectId = 'mock-project-id',
  serviceName,
}: {
  projectId?: string;
  serviceName: string;
}) {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:enable`)
    .reply(200, {});
}

/**
 * Mocks a successful listing of available APIs from the Google API Discovery Service.
 * Returns a predefined list of APIs, including 'docs', 'gmail', and an 'ignored' API.
 */
export function mockListApis() {
  nock('https://www.googleapis.com')
    .get('/discovery/v1/apis')
    .query({preferred: true})
    .reply(200, {
      items: [
        {
          kind: 'discovery#directoryItem',
          id: 'docs:v1',
          name: 'docs',
          version: 'v1',
          title: 'Google Docs API',
          description: 'Reads and writes Google Docs documents.',
          discoveryRestUrl: 'https://docs.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/docs/',
          preferred: true,
        },
        {
          kind: 'discovery#directoryItem',
          id: 'gmail:v1',
          name: 'gmail',
          version: 'v1',
          title: 'Gmail API',
          description: 'The Gmail API lets you view and manage Gmail mailbox data like threads, messages, and labels.',
          discoveryRestUrl: 'https://gmail.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/gmail/api/',
          preferred: true,
        },
        {
          kind: 'discovery#directoryItem',
          id: 'ignored:v1',
          name: 'ignored',
          version: 'v1',
          title: 'Ignored API',
          description: 'This API should be ignored.',
          discoveryRestUrl: 'https://ignored.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/ignored/api/',
          preferred: true,
        },
      ],
    });
}

/**
 * Mocks a successful listing of enabled services for a GCP project from the Google Service Usage API.
 * Returns a predefined list containing the 'docs.googleapis.com' service as enabled.
 * @param {object} options - Options for the mock.
 * @param {string} [options.projectId='mock-project-id'] - The GCP project ID.
 */
export function mockListEnabledServices({projectId = 'mock-project-id'}: {projectId?: string}) {
  nock('https://serviceusage.googleapis.com')
    .get(`/v1/projects/${projectId}/services`)
    .query(true)
    .reply(200, {
      services: [
        {
          name: '123',
          state: 'ENABLED',
          config: {
            name: 'docs.googleapis.com',
          },
        },
      ],
    });
}

/**
 * Mocks a successful listing of log entries from the Google Cloud Logging API.
 * Returns a predefined list of log entries.
 * @param {object} [options={}] - Options for the mock.
 * @param {string} [options.projectId='mock-gcp-project'] - The GCP project ID for which logs are listed.
 * @param {string} [options.timestamp='2023-10-27T10:00:00Z'] - Timestamp for the mock log entry.
 * @param {object[]} [options.entries] - Array of log entry objects to return. Defaults to a single sample log entry.
 */
export function mockListLogEntries({
  projectId = 'mock-gcp-project',
  timestamp = '2023-10-27T10:00:00Z',
  entries = [
    {
      timestamp,
      logName: `projects/${projectId}/logs/stdout`,
      severity: 'INFO',
      insertId: 'test-insert-id',
      resource: {
        type: 'app_script_function',
        labels: {
          project_id: projectId,
          function_name: 'myFunction',
        },
      },
      textPayload: 'test log',
    },
  ],
}: {projectId?: string; timestamp?: string; entries?: object[]} = {}) {
  nock('https://logging.googleapis.com')
    .post(/\/v2\/entries:list/, body => {
      expect(body.resourceNames).to.eql([`projects/${projectId}`]);
      return true;
    })
    .reply(200, {
      entries,
      nextPageToken: undefined,
    });
}

/**
 * Mocks a successful script content push (update) to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to which content is pushed.
 */
export function mockScriptPush({scriptId = 'mock-script-id'}: {scriptId?: string}) {
  nock('https://script.googleapis.com').put(`/v1/projects/${scriptId}/content`).reply(200, {});
}

/**
 * Mocks a successful function run call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to which content is pushed.
 * @param {string} [options.functionName='myFunction'] - The name of the function to run.
 */
export function mockRunFunction({
  scriptId = 'mock-script-id',
  functionName = 'myFunction',
}: {
  scriptId?: string;
  functionName?: string;
}) {
  nock('https://script.googleapis.com')
    .post(`/v1/scripts/${scriptId}:run`, body => {
      expect(body.function).to.equal(functionName);
      return true;
    })
    .reply(200, {
      done: true,
      response: {
        '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionResponse',
        result: 'mock result',
      },
    });
}

/**
 * Mocks a successful entry points call to the Google Apps Script API.
 * @param {object} options - Options for the mock.
 * @param {string} [options.scriptId='mock-script-id'] - The script ID to which content is pushed.
 * @param {string} [options.deploymentId='mock-deployment-id'] - The deployment ID for the entry points.
 */
export function mockEntryPoints({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
}: {
  scriptId?: string;
  deploymentId?: string;
}) {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/deployments/${deploymentId}`)
    .reply(200, {
      entryPoints: [
        {
          entryPointType: 'WEB_APP',
          webApp: {
            url: `https://script.google.com/macros/s/${deploymentId}/exec`,
          },
        },
      ],
    });
}
