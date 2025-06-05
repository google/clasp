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
 * @fileoverview Provides mock implementations for various services and utilities
 * used in `clasp` integration tests. This includes mocking Google API responses
 * using `nock`, simulating filesystem interactions with `mock-fs`, and managing
 * test environment flags. These mocks are essential for creating reproducible
 * and isolated test scenarios.
 */

import {expect} from 'chai';
import mockfs from 'mock-fs';
import nock from 'nock';
import sinon from 'sinon';
import {claspEnv} from '../src/commands/utils.js';

/**
 * Overrides the `claspEnv.isInteractive` flag for testing purposes.
 * @param value The boolean value to set for `isInteractive`.
 */
export function forceInteractiveMode(value: boolean): void {
  claspEnv.isInteractive = value;
}

/**
 * Sets up the general mocking environment for tests.
 * This includes disabling actual network connections via `nock`,
 * initializing a virtual filesystem with `mock-fs`, and setting
 * `claspEnv.isBrowserPresent` to false.
 */
export function setupMocks(): void {
  nock.disableNetConnect(); // Prevent any real HTTP requests.
  mockfs({}); // Initialize an empty virtual filesystem.
  claspEnv.isBrowserPresent = false; // Simulate a non-browser environment.
}

/**
 * Resets all mocks and restores the original environment state.
 * This should be called after each test or test suite.
 */
export function resetMocks(): void {
  mockfs.restore(); // Restore the real filesystem.
  nock.cleanAll(); // Remove all nock interceptors.
  nock.enableNetConnect(); // Re-enable network connections if needed by other parts of the test runner.
  sinon.restore(); // Restore all sinon stubs, spies, and mocks.
  // Reset environment flags to their default detection logic.
  claspEnv.isInteractive = process.stdout.isTTY;
  claspEnv.isBrowserPresent = process.stdout.isTTY;
}

/**
 * Mocks the Google OAuth2 token refresh request.
 * Simulates a successful token refresh.
 */
export function mockOAuthRefreshRequest(): void {
  nock('https://oauth2.googleapis.com')
    .post(/token/) // Match any POST request to the token endpoint.
    .reply(200, {
      access_token: 'mock-refreshed-access-token',
      expires_in: 3600, // Standard expiry time.
    });
}

/**
 * Mocks the Apps Script API endpoint for downloading project content (`projects.getContent`).
 * @param options Options to configure the mock response.
 * @param options.scriptId The script ID for which to mock the download. Defaults to 'mock-script-id'.
 * @param options.version Optional version number to simulate downloading a specific version.
 * @param options.files Array of file objects to return in the mock response. Defaults to a standard set.
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
}: {scriptId?: string; version?: number; files?: Array<{name: string; type: string; source: string}>}): void {
  const queryParameters = version ? {versionNumber: version} : {};
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/content`)
    .query(queryParameters) // Match based on query parameters (e.g., versionNumber).
    .reply(200, {scriptId, files});
}

/**
 * Mocks an error response from the Apps Script API endpoint for downloading project content.
 * @param options Options to configure the mock error response.
 * @param options.scriptId The script ID for which to simulate an error. Defaults to 'mock-script-id'.
 * @param options.statusCode The HTTP status code for the error response. Defaults to 400.
 * @param options.body The response body for the error. Defaults to a generic error structure.
 */
export function mockScriptDownloadError({
  scriptId = 'mock-script-id',
  statusCode = 400,
  body = {error: {errors: [{message: 'Mock script download error'}]}},
}: {scriptId?: string; statusCode?: number; body?: any}): void {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/content`)
    .reply(statusCode, body);
}

/**
 * Mocks the Google Drive API endpoint for listing files, specifically to simulate
 * listing Apps Script projects.
 */
export function mockListScripts(): void {
  nock('https://www.googleapis.com')
    .get('/drive/v3/files')
    .query(true) // Match any query parameters for simplicity.
    .reply(200, {
      files: [
        {id: 'mock-script-id-1', name: 'My First Script'},
        {id: 'mock-script-id-2', name: 'Another Awesome Project'},
        {id: 'mock-script-id-3', name: 'Untitled Project'},
      ],
    });
}

/**
 * Mocks the Apps Script API endpoint for listing project versions.
 * @param options Options to configure the mock response.
 * @param options.scriptId The script ID for which to list versions. Defaults to 'mock-script-id'.
 */
export function mockListVersions({scriptId = 'mock-script-id'}: {scriptId?: string}): void {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/versions`)
    .query(true) // Match any query parameters.
    .reply(200, {
      versions: [
        {scriptId, versionNumber: 1, description: 'Initial version', createTime: new Date().toISOString()},
        {scriptId, versionNumber: 2, description: 'Added new feature', createTime: new Date().toISOString()},
      ],
    });
}

/**
 * Mocks the Apps Script API endpoint for creating a new script project.
 * @param options Options to configure the mock request matching and response.
 * @param options.scriptId The script ID to return in the mock response. Defaults to 'mock-script-id'.
 * @param options.title The expected title in the request body. Defaults to an empty string.
 * @param options.parentId The expected parentId in the request body. Optional.
 */
export function mockCreateScript({
  scriptId = 'mock-script-id',
  title = '',
  parentId,
}: {scriptId?: string; title?: string; parentId?: string}): void {
  nock('https://script.googleapis.com')
    .post(`/v1/projects`, body => {
      // Assert that the request body contains the expected title.
      expect(body.title).to.equal(title);
      if (parentId) expect(body.parentId).to.equal(parentId);
      return true;
    })
    .reply(200, {scriptId, title, parentId, createTime: new Date().toISOString(), updateTime: new Date().toISOString()});
}

/**
 * Mocks the sequence of API calls for creating a container-bound script:
 * 1. Google Drive API to create the container document.
 * 2. Apps Script API to create the script project bound to the container.
 * @param options Options to configure the mock behavior.
 */
export function mockCreateBoundScript({
  scriptId = 'mock-script-id',
  title = 'Bound Script Title',
  mimeType = 'application/vnd.google-apps.spreadsheet', // Default to a Google Sheet.
  parentId = 'mock-container-doc-id', // Expected ID for the new container doc.
}: {scriptId?: string; title?: string; mimeType?: string; parentId?: string}): void {
  // Mock Drive API call to create the container document.
  nock('https://www.googleapis.com')
    .post('/drive/v3/files', driveBody => {
      expect(driveBody.name).to.equal(title);
      expect(driveBody.mimeType).to.equal(mimeType);
      return true;
    })
    .reply(200, {id: parentId}); // Return the mock parentId for the container.

  // Mock Apps Script API call to create the script, expecting the parentId from Drive.
  nock('https://script.googleapis.com')
    .post('/v1/projects', scriptBody => {
      // The title for the script project is often the same as the container.
      // The fixture in create-script.ts uses 'test sheet' for the script title here.
      // Adjust if the actual command behavior differs or make this mock more flexible.
      expect(scriptBody.title).to.equal(title); // Or a more specific title if known.
      expect(scriptBody.parentId).to.equal(parentId);
      return true;
    })
    .reply(200, {scriptId, parentId, title, createTime: new Date().toISOString(), updateTime: new Date().toISOString()});
}

/**
 * Mocks the Apps Script API endpoint for creating a new project version.
 * @param options Options to configure the mock.
 */
export function mockCreateVersion({
  scriptId = 'mock-script-id',
  description = '',
  version = 1, // The version number that the API will "create".
}: {scriptId?: string; description?: string; version?: number | undefined}): void {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/versions`, reqBody => {
      expect(reqBody.description).to.equal(description);
      return true;
    })
    .reply(200, {scriptId, versionNumber: version, description, createTime: new Date().toISOString()});
}

/**
 * Mocks the Apps Script API endpoint for creating a new deployment.
 * @param options Options to configure the mock.
 */
export function mockCreateDeployment({
  scriptId = 'mock-script-id',
  description = '',
  version = 1,
}: {scriptId?: string; description?: string; version?: number}): void {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/deployments`, reqBody => {
      expect(reqBody.description).to.equal(description);
      expect(reqBody.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId: 'mock-deployment-id', // Default mock deployment ID.
      deploymentConfig: {scriptId, versionNumber: version, manifestFileName: 'appsscript', description},
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

/**
 * Mocks the Apps Script API endpoint for updating an existing deployment.
 * @param options Options to configure the mock.
 */
export function mockUpdateDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
  description = '',
  version = 1,
}: {scriptId?: string; deploymentId?: string; description?: string; version?: number}): void {
  nock('https://script.googleapis.com')
    .put(`/v1/projects/${scriptId}/deployments/${deploymentId}`, reqBody => {
      expect(reqBody.deploymentConfig.description).to.equal(description);
      expect(reqBody.deploymentConfig.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId,
      deploymentConfig: {scriptId, versionNumber: version, manifestFileName: 'appsscript', description},
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

/**
 * Mocks the Apps Script API endpoint for deleting a deployment.
 * @param options Options to configure the mock.
 */
export function mockDeleteDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
}: {scriptId?: string; deploymentId?: string}): void {
  nock('https://script.googleapis.com')
    .delete(`/v1/projects/${scriptId}/deployments/${deploymentId}`)
    .reply(200, {}); // Successful deletion usually returns an empty body.
}

/**
 * Mocks the Apps Script API endpoint for listing deployments of a project.
 * @param options Options to configure the mock.
 */
export function mockListDeployments({scriptId = 'mock-script-id'}: {scriptId?: string}): void {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/deployments`)
    .query(true) // Match any query parameters.
    .reply(200, {
      deployments: [
        // Simulate a HEAD deployment (no versionNumber).
        {deploymentId: 'head-deployment-id', deploymentConfig: {scriptId, manifestFileName: 'appsscript', description: 'Latest Code'}},
        // Simulate a versioned deployment.
        {deploymentId: 'mock-deployment-id', deploymentConfig: {scriptId, versionNumber: 1, manifestFileName: 'appsscript', description: 'Version 1 deployment'}},
        {deploymentId: 'mock-deployment-id-2', deploymentConfig: {scriptId, versionNumber: 2, manifestFileName: 'appsscript', description: 'Version 2 deployment'}},
      ],
    });
}

/**
 * Mocks the Google Service Usage API endpoint for disabling a service in a GCP project.
 * @param options Options to configure the mock.
 */
export function mockDisableService({
  projectId = 'mock-gcp-project-id', // Default mock GCP project ID.
  serviceName, // e.g., 'sheets.googleapis.com'
}: {projectId?: string; serviceName: string}): void {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:disable`)
    .reply(200, {}); // Successful disabling returns an empty body.
}

/**
 * Mocks the Google Service Usage API endpoint for enabling a service in a GCP project.
 * @param options Options to configure the mock.
 */
export function mockEnableService({
  projectId = 'mock-gcp-project-id',
  serviceName, // e.g., 'sheets.googleapis.com'
}: {projectId?: string; serviceName: string}): void {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:enable`)
    .reply(200, {}); // Successful enabling returns an empty body.
}

/**
 * Mocks the Google API Discovery Service endpoint for listing available APIs.
 * Provides a sample list of APIs, including some that are Advanced Services and some that are not.
 */
export function mockListApis(): void {
  nock('https://www.googleapis.com')
    .get('/discovery/v1/apis')
    .query({preferred: true}) // Match the 'preferred=true' query parameter.
    .reply(200, {
      items: [
        // Example of an Apps Script Advanced Service.
        {kind: 'discovery#directoryItem', id: 'sheets:v4', name: 'sheets', version: 'v4', title: 'Google Sheets API', description: 'Reads and writes Google Sheets.', preferred: true},
        {kind: 'discovery#directoryItem', id: 'drive:v3', name: 'drive', version: 'v3', title: 'Google Drive API', description: 'Manages files in Google Drive.', preferred: true},
        {kind: 'discovery#directoryItem', id: 'gmail:v1', name: 'gmail', version: 'v1', title: 'Gmail API', description: 'Access to Gmail mailboxes.', preferred: true},
        {kind: 'discovery#directoryItem', id: 'docs:v1', name: 'docs', version: 'v1', title: 'Google Docs API', description: 'Reads and writes Google Docs.', preferred: true},
        // Example of a Google API that is NOT typically an Apps Script Advanced Service by default.
        {kind: 'discovery#directoryItem', id: 'translate:v2', name: 'translate', version: 'v2', title: 'Google Translate API', description: 'Translates text between languages.', preferred: true},
        // Example of a service that might be filtered out by name if not in PUBLIC_ADVANCED_SERVICES.
        {kind: 'discovery#directoryItem', id: 'ignored:v1', name: 'ignored', version: 'v1', title: 'Ignored API', description: 'This API should be ignored by clasp logic for advanced services.', preferred: true},
      ],
    });
}

/**
 * Mocks the Google Service Usage API endpoint for listing enabled services in a GCP project.
 * @param options Options to configure the mock.
 * @param options.projectId The GCP project ID for which to mock enabled services. Defaults to 'mock-gcp-project-id'.
 */
export function mockListEnabledServices({projectId = 'mock-gcp-project-id'}: {projectId?: string}): void {
  nock('https://serviceusage.googleapis.com')
    .get(`/v1/projects/${projectId}/services`)
    .query(true) // Match any query parameters, including 'filter=state:ENABLED'.
    .reply(200, {
      services: [
        // Simulate 'docs.googleapis.com' being enabled.
        {name: `projects/${projectId}/services/docs.googleapis.com`, state: 'ENABLED', config: {name: 'docs.googleapis.com', title: 'Google Docs API'}},
        // Simulate 'drive.googleapis.com' being enabled.
        {name: `projects/${projectId}/services/drive.googleapis.com`, state: 'ENABLED', config: {name: 'drive.googleapis.com', title: 'Google Drive API'}},
        // Simulate a service that might be enabled in GCP but isn't an Apps Script Advanced Service.
        {name: `projects/${projectId}/services/translate.googleapis.com`, state: 'ENABLED', config: {name: 'translate.googleapis.com', title: 'Google Translate API'}},
      ],
    });
}

/**
 * Mocks the Google Cloud Logging API endpoint for listing log entries.
 * @param options Options to configure the mock log entries.
 */
export function mockListLogEntries({
  projectId = 'mock-gcp-project-id', // Default mock GCP project ID.
  timestamp = new Date().toISOString(), // Default to current time.
  entries = [ // Default mock log entries.
    {
      timestamp,
      logName: `projects/${projectId}/logs/script.googleapis.com%2Fconsole_logs`, // Example logName
      severity: 'INFO',
      insertId: 'mock-insert-id-1',
      resource: {type: 'app_script_function', labels: {project_id: projectId, function_name: 'myFunction'}},
      textPayload: 'First test log entry.',
    },
    {
      timestamp,
      logName: `projects/${projectId}/logs/script.googleapis.com%2Fconsole_logs`,
      severity: 'ERROR',
      insertId: 'mock-insert-id-2',
      resource: {type: 'app_script_function', labels: {project_id: projectId, function_name: 'anotherFunction'}},
      jsonPayload: {fields: {message: {stringValue: 'Second test log with error.'}}}, // Example jsonPayload
    },
  ],
}: {projectId?: string; timestamp?: string; entries?: object[]} = {}): void {
  nock('https://logging.googleapis.com')
    .post(/\/v2\/entries:list/, body => {
      // Basic check on the request body. More specific checks can be added if needed.
      expect(body.resourceNames).to.eql([`projects/${projectId}`]);
      return true;
    })
    .reply(200, {entries, nextPageToken: undefined});
}

/**
 * Mocks the Apps Script API endpoint for pushing/updating project content.
 * @param options Options to configure the mock.
 * @param options.scriptId The script ID for which to mock the push. Defaults to 'mock-script-id'.
 */
export function mockScriptPush({scriptId = 'mock-script-id'}: {scriptId?: string}): nock.Scope {
  // Returns the nock scope so that tests can check `isDone()` if needed.
  return nock('https://script.googleapis.com')
    .put(`/v1/projects/${scriptId}/content`) // Match PUT request to update content.
    .reply(200, {}); // Simulate a successful push with an empty object response.
}
