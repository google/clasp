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

// This file defines the `Project` class, which is responsible for managing
// Google Apps Script project metadata, lifecycle operations (creation, versions,
// deployments), and local project configuration settings.

import Debug from 'debug';
import fs from 'fs/promises';
import {google} from 'googleapis';
import {script_v1} from 'googleapis';

import {fetchWithPages} from './utils.js';
import {ClaspOptions, assertAuthenticated, assertScriptConfigured, handleApiError} from './utils.js';

import path from 'path';
import {Manifest} from './manifest.js';

const debug = Debug('clasp:core');

type Script = {
  name: string;
  id: string;
};

/**
 * Manages Google Apps Script project settings and interactions with the
 * Apps Script API for operations like creating projects, versions,
 * and deployments. It also handles reading and writing the local
 * `.clasp.json` configuration file and the `appsscript.json` manifest.
 */
export class Project {
  private options: ClaspOptions;

  constructor(options: ClaspOptions) {
    this.options = options;
  }

  get scriptId(): string | undefined {
    return this.options.project?.scriptId;
  }

  get projectId(): string | undefined {
    return this.options.project?.projectId;
  }

  get parentId(): string | undefined {
    return this.options.project?.parentId;
  }

  // TODO - Do we need the assertion or can just use accessor?
  /**
   * Retrieves the Google Cloud Platform (GCP) project ID associated with the script.
   * Asserts that the script is configured before returning the ID.
   * @returns {string | undefined} The GCP project ID, or undefined if not set.
   * @throws {Error} If the script is not configured.
   */
  getProjectId(): string | undefined {
    assertScriptConfigured(this.options);
    return this.options.project.projectId;
  }

  /**
   * Creates a new standalone Apps Script project.
   * @param {string} name - The title for the new script project.
   * @param {string} [parentId] - Optional ID of a Google Drive folder to create the script in.
   * @returns {Promise<string>} A promise that resolves to the script ID of the newly created project.
   * @throws {Error} If there's an API error or authentication issues.
   */
  async createScript(name: string, parentId?: string): Promise<string> {
    debug('Creating script %s', name);
    assertAuthenticated(this.options);

    if (this.options.project?.scriptId) {
      debug('Warning: Creating script while id already exists');
    }

    const credentials = this.options.credentials;
    const script = google.script({version: 'v1', auth: credentials});
    try {
      const requestOptions = {
        requestBody: {
          parentId,
          title: name,
        },
      };
      debug('Creating project with request %O', requestOptions);
      const res = await script.projects.create(requestOptions);
      if (!res.data.scriptId) {
        throw new Error('Unexpected error, script ID missing from response.');
      }
      debug('Created script %s', res.data.scriptId);
      const scriptId = res.data.scriptId;
      this.options.project = {scriptId, parentId};
      return scriptId;
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Moves the specified Google Drive file to the trash.
   * @returns {Promise<void>} A promise that resolves when the file is successfully trashed.
   */
  async trashScript(): Promise<void> {
    debug('Deleting script %s', this.options.project?.scriptId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const fileId = this.options.project.scriptId;
    const credentials = this.options.credentials;
    const drive = google.drive({version: 'v3', auth: credentials});
    try {
      const requestOptions = {
        fileId,
        requestBody: {
          trashed: true,
        },
      };
      debug('Trashing script with request %O', requestOptions);
      await drive.files.update(requestOptions);
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Creates a new Google Drive file (e.g., Sheet, Doc) and a bound Apps Script project for it.
   * @param {string} name - The title for the new Drive file and script project.
   * @param {string} mimeType - The MIME type of the Drive file to create (e.g., 'application/vnd.google-apps.spreadsheet').
   * @returns {Promise<{scriptId: string; parentId: string}>} A promise that resolves to an object
   * containing the script ID and the parent Drive file ID.
   * @throws {Error} If there's an API error or authentication issues.
   */
  async createWithContainer(name: string, mimeType: string): Promise<{scriptId: string; parentId: string}> {
    debug('Creating container bound script %s (%s)', name, mimeType);
    assertAuthenticated(this.options);

    if (this.options.project?.scriptId) {
      debug('Warning: Creating script while id already exists');
    }

    let parentId: string | null | undefined;

    const credentials = this.options.credentials;
    const drive = google.drive({version: 'v3', auth: credentials});
    // Create the container file (e.g., Google Sheet, Doc) using the Drive API.
    try {
      const requestOptions = {
        requestBody: {
          mimeType,
          name,
        },
      };
      debug('Creating project with request %O', requestOptions);
      const res = await drive.files.create(requestOptions);
      parentId = res.data.id; // Get the ID of the newly created container file.
      debug('Created container %s', parentId);
      if (!parentId) {
        throw new Error('Unexpected error, container ID missing from response.');
      }
    } catch (error) {
      handleApiError(error);
    }

    // Once the container is created, create an Apps Script project bound to it.
    const scriptId = await this.createScript(name, parentId);
    return {
      parentId, // Return the ID of the container.
      scriptId,
    };
  }

  /**
   * Lists Apps Script projects accessible by the authenticated user from Google Drive.
   * @returns {Promise<{results: Script[], partialResults: boolean} | undefined>}
   * A promise that resolves to an object containing an array of script projects
   * (with name and ID) and a flag indicating if results are partial, or undefined on error.
   * @throws {Error} If there's an API error or authentication issues.
   */
  async listScripts() {
    debug('Fetching scripts');
    assertAuthenticated(this.options);

    const credentials = this.options.credentials;
    const drive = google.drive({version: 'v3', auth: credentials});
    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const requestOptions = {
          pageSize,
          pageToken,
          fields: 'nextPageToken, files(id, name)',
          q: 'mimeType="application/vnd.google-apps.script"',
        };
        debug('Fetching scripts from drive with request %O', requestOptions);
        const res = await drive.files.list(requestOptions);
        return {
          results: (res.data.files ?? []) as Script[],
          pageToken: res.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Creates a new immutable version of the Apps Script project.
   * @param {string} [description=''] - An optional description for the new version.
   * @returns {Promise<number>} A promise that resolves to the newly created version number.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async version(description = ''): Promise<number> {
    debug('Creating version: %s', description);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const credentials = this.options.credentials;
    const scriptId = this.options.project.scriptId;

    const script = google.script({version: 'v1', auth: credentials});

    try {
      const requestOptions = {
        requestBody: {
          description: description ?? '',
        },
        scriptId: scriptId,
      };
      debug('Creating version with request %O', requestOptions);
      const res = await script.projects.versions.create(requestOptions);
      const versionNumber = res.data.versionNumber ?? 0;
      debug('Created new version %d', versionNumber);
      return versionNumber;
    } catch (error) {
      handleApiError(error);
    }
  }
  /**
   * Lists all immutable versions of the Apps Script project.
   * @returns {Promise<{results: script_v1.Schema$Version[], partialResults: boolean} | undefined>}
   * A promise that resolves to an object containing an array of version objects
   * and a flag indicating if results are partial, or undefined on error.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async listVersions() {
    debug('Fetching versions');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});
    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const requestOptions = {
          scriptId,
          pageSize,
          pageToken,
        };
        debug('Fetching versions with request %O', requestOptions);
        const res = await script.projects.versions.list(requestOptions);
        return {
          results: res.data.versions ?? [],
          pageToken: res.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Lists all deployments for the Apps Script project.
   * @returns {Promise<{results: script_v1.Schema$Deployment[], partialResults: boolean} | undefined>}
   * A promise that resolves to an object containing an array of deployment objects
   * and a flag indicating if results are partial, or undefined on error.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async listDeployments() {
    debug('Listing deployments');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});
    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const requestOptions = {
          scriptId,
          pageSize,
          pageToken,
        };
        debug('Fetching deployments with request %O', requestOptions);
        const res = await script.projects.deployments.list(requestOptions);
        return {
          results: res.data.deployments ?? [],
          pageToken: res.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Creates a new deployment or updates an existing one for the Apps Script project.
   * If `versionNumber` is not provided, a new script version is created with the given `description`.
   * @param {string} [description=''] - Description for the new version (if created) or deployment.
   * @param {string} [deploymentId] - Optional ID of an existing deployment to update. If not provided, a new deployment is created.
   * @param {number} [versionNumber] - Optional specific script version number to deploy.
   * @returns {Promise<script_v1.Schema$Deployment>} A promise that resolves to the deployment object.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async deploy(description = '', deploymentId?: string, versionNumber?: number): Promise<script_v1.Schema$Deployment> {
    debug('Deploying project: %s (%s)', description, versionNumber ?? 'HEAD');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    // If no specific versionNumber is provided for deployment,
    // create a new version of the script with the given description.
    if (versionNumber === undefined) {
      versionNumber = await this.version(description);
    }

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});

    try {
      let deployment: script_v1.Schema$Deployment | undefined;
      // If no deploymentId is provided, create a new deployment.
      if (!deploymentId) {
        const requestOptions = {
          scriptId: scriptId, // The scriptId must be provided in the request body for create.
          requestBody: {
            description: description ?? '',
            versionNumber: versionNumber,
            manifestFileName: 'appsscript',
          },
        };
        debug('Creating deployment with request %O', requestOptions);
        const res = await script.projects.deployments.create(requestOptions);
        deployment = res.data;
      } else {
        // If a deploymentId is provided, update the existing deployment.
        const requestOptions = {
          scriptId: scriptId, // Path parameter for the scriptId.
          deploymentId: deploymentId, // Path parameter for the deploymentId to update.
          requestBody: {
            deploymentConfig: {
              description: description ?? '',
              versionNumber: versionNumber,
              scriptId: scriptId, // The scriptId also needs to be in the deploymentConfig.
              manifestFileName: 'appsscript',
            },
          },
        };
        debug('Updating existing deployment with request %O', requestOptions);
        const res = await script.projects.deployments.update(requestOptions);
        deployment = res.data;
      }
      return deployment; // Return the created or updated deployment object.
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Retrieves the entry points for a specific deployment of the Apps Script project.
   * Entry points define how the script can be executed (e.g., as a web app, API executable).
   * @param {string} deploymentId - The ID of the deployment.
   * @returns {Promise<script_v1.Schema$EntryPoint[] | undefined>} A promise that resolves to an array
   * of entry point objects, or undefined if an error occurs.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async entryPoints(deploymentId: string) {
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});
    try {
      const res = await script.projects.deployments.get({scriptId, deploymentId});
      const entryPoints = res.data?.entryPoints ?? [];
      return entryPoints;
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Deletes a specific deployment of the Apps Script project.
   * @param {string} deploymentId - The ID of the deployment to delete.
   * @returns {Promise<void>} A promise that resolves when the deployment is deleted.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async undeploy(deploymentId: string): Promise<void> {
    debug('Deleting deployment %s', deploymentId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});

    try {
      const requestOptions = {
        scriptId: scriptId,
        deploymentId,
      };
      debug('Deleting deployment with request %O', requestOptions);
      await script.projects.deployments.delete(requestOptions);
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Writes the current project settings (script ID, root directory, parent ID, project ID,
   * file extensions, push order, skip subdirectories) to the `.clasp.json` file.
   * @returns {Promise<void>} A promise that resolves when the settings are written.
   * @throws {Error} If the script is not configured or there's a file system error.
   */
  async updateSettings(): Promise<void> {
    debug('Updating settings');
    assertScriptConfigured(this.options);

    const srcDir = path.relative(this.options.files.projectRootDir, this.options.files.contentDir);
    const settings = {
      scriptId: this.options.project.scriptId,
      rootDir: srcDir,
      parentId: this.options.project.parentId,
      projectId: this.options.project.projectId,
      scriptExtensions: this.options.files.fileExtensions['SERVER_JS'],
      htmlExtensions: this.options.files.fileExtensions['HTML'],
      jsonExtensions: this.options.files.fileExtensions['JSON'],
      filePushOrder: [],
      skipSubdirectories: this.options.files.skipSubdirectories,
    };
    await fs.writeFile(this.options.configFilePath, JSON.stringify(settings, null, 2));
  }

  /**
   * Sets the Google Cloud Platform (GCP) project ID for the current Apps Script project
   * and updates the `.clasp.json` file.
   * @param {string | undefined} projectId - The GCP project ID to set.
   * @returns {Promise<void>} A promise that resolves when the project ID is set and settings are updated.
   * @throws {Error} If the script is not configured.
   */
  async setProjectId(projectId: string | undefined): Promise<void> {
    debug('Setting project ID %s in file %s', projectId, this.options.configFilePath);
    assertScriptConfigured(this.options);
    this.options.project.projectId = projectId;
    await this.updateSettings();
  }

  /**
   * Checks if a script project is currently configured (i.e., if a script ID is set).
   * @returns {boolean} True if a script ID is set, false otherwise.
   */
  exists(): boolean {
    return this.options.project?.scriptId !== undefined;
  }

  /**
   * Reads and parses the `appsscript.json` manifest file from the project's content directory.
   * @returns {Promise<Manifest>} A promise that resolves to the parsed manifest object.
   * @throws {Error} If the script is not configured or the manifest file cannot be read/parsed.
   */
  async readManifest(): Promise<Manifest> {
    debug('Reading manifest');
    assertScriptConfigured(this.options);
    const manifestPath = path.join(this.options.files.contentDir, 'appsscript.json');
    debug('Manifest path is %s', manifestPath);
    const content = await fs.readFile(manifestPath);
    const manifest: Manifest = JSON.parse(content.toString());
    return manifest;
  }

  /**
   * Fetch metrics for the Apps Script project.
   * @returns {Promise<script_v1.Schema$Metrics | undefined>} A promise that resolves to the metrics object.
   */
  async getMetrics(): Promise<script_v1.Schema$Metrics | undefined> {
    debug('Fetching metrics');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});
    try {
      const res = await script.projects.getMetrics({scriptId});
      return res.data;
    } catch (error) {
      handleApiError(error);
    }
  }
}
