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
 * @fileoverview Unit and integration tests for the `Project` class in `src/core/project.ts`.
 * These tests cover various project-level operations including:
 * - Creating standalone and container-bound Apps Script projects.
 * - Listing user's script projects.
 * - Managing script versions (creating, listing).
 * - Managing script deployments (creating, listing, updating, deleting).
 * - Handling project settings (.clasp.json) and manifest (appsscript.json) files.
 * - Behavior under different authentication and local configuration states.
 */

import path from 'path';

import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';

import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a mock OAuth2Client instance for testing.
 * @returns A mock OAuth2Client.
 */
function mockCredentials(): OAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

// Main test suite for project-level operations.
describe('Project operations', function () {
  // Common setup and teardown for mocks.
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  // Test suite for scenarios where no local .clasp.json project file exists, but the user is authenticated.
  describe('with no local project (.clasp.json missing), authenticated', function () {
    beforeEach(function () {
      // Mock an empty filesystem, but .clasprc.json will be mocked by initClaspInstance or global setup if needed.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test creating a new standalone script.
    it('should create a new standalone script with a given name', async function () {
      // Mock the Apps Script API endpoint for creating projects.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test script'); // Verify title in request.
          expect(body.parentId).to.be.undefined;   // No parentId for standalone.
          return true;
        })
        .reply(200, {scriptId: 'mock-script-id'}); // Simulate successful creation.

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const scriptId = await clasp.project.createScript('test script');
      expect(scriptId).to.equal('mock-script-id');
    });

    // Test creating a new script with a specified parent ID (e.g., in a Drive folder).
    it('should create a new script with a specified parent ID', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test script');
          expect(body.parentId).to.equal('mock-parent-id'); // Verify parentId.
          return true;
        })
        .reply(200, {scriptId: 'mock-script-id', parentId: 'mock-parent-id'});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const scriptId = await clasp.project.createScript('test script', 'mock-parent-id');
      expect(scriptId).to.equal('mock-script-id');
    });

    // Test creating a new script bound to a new container document (e.g., Google Sheet).
    it('should create a new script and its container document', async function () {
      // Mock Google Drive API for creating the container file.
      nock('https://www.googleapis.com')
        .post(/drive\/v3\/files/, body => {
          expect(body.name).to.equal('test sheet');
          expect(body.mimeType).to.equal('application/vnd.google-apps.spreadsheet');
          return true;
        })
        .reply(200, {id: 'mock-parent-id'}); // Return ID of the created container.

      // Mock Apps Script API for creating the script bound to the container.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test sheet');
          expect(body.parentId).to.equal('mock-parent-id');
          return true;
        })
        .reply(200, {scriptId: 'mock-script-id', parentId: 'mock-parent-id'});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const {scriptId, parentId} = await clasp.project.createWithContainer(
        'test sheet',
        'application/vnd.google-apps.spreadsheet',
      );
      expect(scriptId).to.equal('mock-script-id');
      expect(parentId).to.equal('mock-parent-id');
    });

    // Test listing available Apps Script projects.
    it('should list available Apps Script projects', async function () {
      // Mock Drive API to return a list of script files.
      nock('https://www.googleapis.com')
        .get(/drive\/v3\/files/) // Matches the list request.
        .query(true) // Allow any query parameters for simplicity here.
        .reply(200, {
          files: [
            {id: 'id1', name: 'script 1'},
            {id: 'id2', name: 'script 2'},
          ],
        });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const scripts = await clasp.project.listScripts();
      expect(scripts.results).to.have.length(2);
      expect(scripts.results.map(s => s.name)).to.include.members(['script 1', 'script 2']);
    });

    // Operations that require an existing project (scriptId) should fail.
    it('should fail to create a version if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // `version()` asserts script configuration.
      return expect(clasp.project.version()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to list versions if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      return expect(clasp.project.listVersions()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to list deployments if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      return expect(clasp.project.listDeployments()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to deploy if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      return expect(clasp.project.deploy()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to undeploy if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      return expect(clasp.project.undeploy('id')).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to update settings if no project is configured (no scriptId to save)', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // updateSettings asserts script configuration (which requires scriptId).
      return expect(clasp.project.updateSettings()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to get project ID if no project is configured', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // getProjectId asserts script configuration.
      expect(() => clasp.project.getProjectId()).to.throw(Error, /Project settings not found/);
    });

    it('should correctly indicate project does not exist (no scriptId)', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      expect(clasp.project.exists()).to.be.false;
    });

    // Test that after setting a scriptId (e.g., after createScript), settings can be saved.
    it('should save settings to .clasp.json once a scriptId is associated', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      clasp.withScriptId('mock-script-id'); // Simulate associating a scriptId post-creation.
      await clasp.project.updateSettings(); // This should now succeed and create .clasp.json.
      expect('.clasp.json').to.be.a.realFile();
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Test suite for operations on an existing, configured local project (i.e., .clasp.json exists).
  describe('with existing local project (.clasp.json present), authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with a standard project setup.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // Contains a scriptId.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test creating a new version for the project.
    it('should create a new project version with description', async function () {
      // Mock the Apps Script API endpoint for creating versions.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/mock-script-id\/versions/, body => { // Assumes scriptId in fixture is 'mock-script-id'.
          expect(body.description).to.equal('New release');
          return true;
        })
        .reply(200, {versionNumber: 2}); // Simulate successful version creation.

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const version = await clasp.project.version('New release');
      expect(version).to.equal(2);
    });

    // Test listing existing versions of the project.
    it('should list project versions', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/mock-script-id\/versions/)
        .reply(200, {
          versions: [{versionNumber: 1, description: 'Initial'}, {versionNumber: 2, description: 'Update'}],
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const versionsResult = await clasp.project.listVersions();
      expect(versionsResult.results).to.have.length(2);
    });

    // Test listing existing deployments for the project.
    it('should list project deployments', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/mock-script-id\/deployments/)
        .reply(200, {
          deployments: [{deploymentId: 'depId1', deploymentConfig: {versionNumber: 1, description: 'V1 deploy'}}],
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const deploymentsResult = await clasp.project.listDeployments();
      expect(deploymentsResult.results).to.have.length(1);
      expect(deploymentsResult.results[0].deploymentId).to.equal('depId1');
    });

    // Test creating a new deployment, which should also create a new version by default.
    it('should create a new version and then a new deployment if no version specified', async function () {
      // Mock version creation.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/mock-script-id\/versions/, body => {
          expect(body.description).to.equal('Test Deployment');
          return true;
        })
        .reply(200, {versionNumber: 3});
      // Mock deployment creation, expecting it to use the newly created version 3.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/mock-script-id\/deployments/, body => {
          expect(body.versionNumber).to.equal(3);
          expect(body.description).to.equal('Test Deployment');
          return true;
        })
        .reply(200, {deploymentId: 'newDepId', deploymentConfig: {versionNumber: 3, description: 'Test Deployment'}});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const deployment = await clasp.project.deploy('Test Deployment');
      expect(deployment).to.exist;
      expect(deployment.deploymentConfig?.versionNumber).to.equal(3);
    });

    // Test deploying a specific, existing version without creating a new one.
    it('should deploy a specified version without creating a new script version', async function () {
      // Ensure version creation is NOT called by nock.
      // `nock.post(/.../versions)` without a reply will cause an error if called.
      // Mock deployment creation for a specific version.
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/mock-script-id\/deployments/, body => {
          expect(body.versionNumber).to.equal(2); // Expecting deployment of existing version 2.
          expect(body.description).to.equal('Deploying V2');
          return true;
        })
        .reply(200, {deploymentId: 'depV2', deploymentConfig: {versionNumber: 2, description: 'Deploying V2'}});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // Pass description, no deploymentId (so create new), and specific versionNumber.
      const deployment = await clasp.project.deploy('Deploying V2', undefined, 2);
      expect(deployment).to.exist;
      expect(deployment.deploymentConfig?.versionNumber).to.equal(2);
    });

    // Test deleting a deployment.
    it('should undeploy (delete) a specific deployment', async function () {
      nock('https://script.googleapis.com')
        .delete(/\/v1\/projects\/mock-script-id\/deployments\/depToDel/) // Match specific deployment ID.
        .reply(200, {}); // Simulate successful deletion.

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      await expect(clasp.project.undeploy('depToDel')).to.eventually.be.fulfilled;
    });

    // Test updating the local .clasp.json settings file.
    it('should update .clasp.json settings file correctly', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // Modify some settings that would be saved.
      clasp.withContentDir('newSrc'); // This modifies internal options.
      await clasp.project.setProjectId('new-gcp-id'); // This calls updateSettings.
      // Read the file to check its content.
      const settingsContent = await fs.readFile('.clasp.json', 'utf8');
      const settings = JSON.parse(settingsContent);
      expect(settings.scriptId).to.equal('mock-script-id'); // From fixture
      expect(settings.rootDir).to.equal('newSrc');
      expect(settings.projectId).to.equal('new-gcp-id');
    });

    // Test retrieving the GCP project ID.
    it('should get the configured GCP project ID', async function () {
      // .clasp.json from fixture should have a projectId.
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // dot-clasp-no-settings.json does NOT have projectId, so this test would fail
      // unless the fixture is dot-clasp-gcp-project.json or similar.
      // Re-mocking for this specific test case to ensure projectId is present.
      mockfs.restore(); // Clear previous mockfs
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      const newClaspInstance = await initClaspInstance({credentials: mockCredentials()});
      expect(newClaspInstance.project.getProjectId()).to.equal('mock-gcp-project'); // From dot-clasp-gcp-project.json
    });

    // Test the exists() method.
    it('should correctly indicate that the project exists', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      expect(clasp.project.exists()).to.be.true; // Because .clasp.json (with scriptId) is loaded.
    });

    afterEach(function () {
      mockfs.restore();
    });
  });
});
