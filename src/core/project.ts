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
 * @fileoverview Manages Apps Script project-level operations such as creating
 * new projects (standalone or container-bound), listing projects, managing
 * versions and deployments, and updating project settings in the `.clasp.json` file.
 */

import Debug from 'debug';
import fs from 'fs/promises';
import {google} from 'googleapis';
import {script_v1} from 'googleapis';

import {fetchWithPages} from './utils.js';
import {ClaspOptions, assertAuthenticated, assertScriptConfigured, handleApiError} from './utils.js';

import path from 'path';
import {Manifest} from './manifest.js';

const debug = Debug('clasp:core');

/**
 * Represents a simplified view of an Apps Script project, typically used when listing scripts.
 */
type Script = {
  /** The name of the Apps Script project. */
  name: string;
  /** The unique identifier (script ID) of the Apps Script project. */
  id: string;
};

/**
 * Manages Apps Script project-specific operations, including metadata,
 * versions, deployments, and local project settings.
 */
export class Project {
  private options: ClaspOptions;

  /**
   * Constructs a Project manager instance.
   * @param options The Clasp configuration options.
   */
  constructor(options: ClaspOptions) {
    this.options = options;
  }

  /** Gets the script ID of the current project, if configured. */
  get scriptId(): string | undefined {
    return this.options.project?.scriptId;
  }

  /** Gets the GCP project ID linked to the current project, if configured. */
  get projectId(): string | undefined {
    return this.options.project?.projectId;
  }

  /** Gets the Google Drive ID of the container document, if this is a container-bound script. */
  get parentId(): string | undefined {
    return this.options.project?.parentId;
  }

  /**
   * Retrieves the GCP project ID.
   * @returns The GCP project ID, or undefined if not set.
   * @throws If the script ID is not configured (as a prerequisite for having a GCP project ID).
   * @todo Review if the `assertScriptConfigured` is strictly necessary here or if `this.options.project.projectId` is sufficient.
   */
  getProjectId(): string | undefined {
    assertScriptConfigured(this.options); // Ensures scriptId is available, which is a common prerequisite.
    return this.options.project.projectId;
  }

  /**
   * Creates a new standalone Apps Script project.
   * @param name The title for the new script project.
   * @param parentId Optional Google Drive ID of a parent folder for the new script.
   * @returns A promise that resolves with the script ID of the newly created project.
   */
  async createScript(name: string, parentId?: string): Promise<string> {
    debug('Attempting to create a new Apps Script project with title: "%s"', name);
    assertAuthenticated(this.options); // Authentication is required.

    if (this.options.project?.scriptId) {
      // Log a warning but proceed, as this might be intentional in some edge cases (e.g., re-initializing).
      debug('Warning: Attempting to create a script, but a scriptId (%s) already exists in the current clasp configuration.', this.options.project.scriptId);
    }

    const {credentials} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});
    try {
      const createRequest = {
        requestBody: {title: name, parentId},
      };
      debug('Sending request to script.projects.create: %O', createRequest.requestBody);
      const response = await scriptService.projects.create(createRequest);

      const newScriptId = response.data.scriptId;
      if (!newScriptId) {
        throw new Error('API response for project creation did not include a script ID.');
      }
      debug('Successfully created new script with ID: %s', newScriptId);

      // Update current clasp instance's project settings.
      this.options.project = {scriptId: newScriptId, parentId};
      return newScriptId;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Creates a new container-bound Apps Script project (e.g., bound to a new Google Sheet or Doc).
   * This involves creating the container file in Google Drive first, then creating the script project bound to it.
   * @param name The title for both the new container document and the Apps Script project.
   * @param mimeType The MIME type of the Google Drive container to create (e.g., 'application/vnd.google-apps.spreadsheet').
   * @returns A promise that resolves with an object containing the `scriptId` and `parentId` (the ID of the container document).
   */
  async createWithContainer(name: string, mimeType: string): Promise<{scriptId: string; parentId: string}> {
    debug('Attempting to create a new container-bound script: "%s" (MIME Type: %s)', name, mimeType);
    assertAuthenticated(this.options);

    if (this.options.project?.scriptId) {
      debug('Warning: Attempting to create a script, but a scriptId (%s) already exists in the current clasp configuration.', this.options.project.scriptId);
    }

    let newParentId: string | undefined | null;
    const {credentials} = this.options;
    const driveService = google.drive({version: 'v3', auth: credentials});

    try {
      // Create the container document (e.g., Google Sheet).
      const driveFileCreateRequest = {requestBody: {mimeType, name}};
      debug('Creating container document in Google Drive: %O', driveFileCreateRequest.requestBody);
      const driveResponse = await driveService.files.create(driveFileCreateRequest);
      newParentId = driveResponse.data.id;

      if (!newParentId) {
        throw new Error('API response for Drive file creation did not include a file ID.');
      }
      debug('Successfully created container document with ID: %s', newParentId);
    } catch (error) {
      return handleApiError(error); // Rethrow as a standardized API error.
    }

    // Create the Apps Script project bound to the new container document.
    // The `createScript` method will update `this.options.project`.
    const newScriptId = await this.createScript(name, newParentId);
    return {parentId: newParentId, scriptId: newScriptId};
  }

  /**
   * Lists Apps Script projects accessible by the authenticated user from Google Drive.
   * @returns A promise that resolves with an object containing an array of `Script` objects (`results`)
   *          and a boolean `partialResults` indicating if more results might be available (due to pagination limits).
   */
  async listScripts(): Promise<{results: Script[]; partialResults: boolean}> {
    debug('Fetching list of user\'s Apps Script projects from Google Drive...');
    assertAuthenticated(this.options);

    const {credentials} = this.options;
    const driveService = google.drive({version: 'v3', auth: credentials});
    try {
      // Use fetchWithPages to handle potential pagination from the Drive API.
      return fetchWithPages(async (pageSize, pageToken) => {
        const driveListRequest = {
          pageSize,
          pageToken,
          fields: 'nextPageToken, files(id, name)', // Request only necessary fields.
          q: 'mimeType="application/vnd.google-apps.script"', // Filter for Apps Script files.
        };
        debug('Requesting Drive files list: %O', driveListRequest);
        const response = await driveService.files.list(driveListRequest);
        return {
          results: (response.data.files ?? []) as Script[],
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Creates a new immutable version of the current Apps Script project.
   * @param description Optional description for the new version. Defaults to an empty string.
   * @returns A promise that resolves with the new version number.
   */
  async version(description = ''): Promise<number> {
    debug('Creating a new version for script ID %s with description: "%s"', this.scriptId, description);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options); // A script must be configured to create a version.

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      const versionCreateRequest = {
        scriptId: project.scriptId!, // Asserted by assertScriptConfigured
        requestBody: {description: description ?? ''},
      };
      debug('Requesting script.projects.versions.create: %O', versionCreateRequest.requestBody);
      const response = await scriptService.projects.versions.create(versionCreateRequest);

      const newVersionNumber = response.data.versionNumber;
      if (typeof newVersionNumber !== 'number') {
        // Should not happen if API behaves as expected.
        throw new Error('API response for version creation did not include a version number.');
      }
      debug('Successfully created version: %d', newVersionNumber);
      return newVersionNumber;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Lists all immutable versions of the current Apps Script project.
   * @returns A promise that resolves with an object containing an array of version objects (`results`)
   *          and a boolean `partialResults` indicating if more results might be available.
   */
  async listVersions(): Promise<{results: script_v1.Schema$Version[]; partialResults: boolean}> {
    debug('Fetching versions for script ID: %s', this.scriptId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const versionsListRequest = {
          scriptId: project.scriptId!, // Asserted
          pageSize,
          pageToken,
        };
        debug('Requesting script.projects.versions.list: %O', versionsListRequest);
        const response = await scriptService.projects.versions.list(versionsListRequest);
        return {
          results: response.data.versions ?? [],
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Lists all deployments of the current Apps Script project.
   * @returns A promise that resolves with an object containing an array of deployment objects (`results`)
   *          and a boolean `partialResults` indicating if more results might be available.
   */
  async listDeployments(): Promise<{results: script_v1.Schema$Deployment[]; partialResults: boolean}> {
    debug('Fetching deployments for script ID: %s', this.scriptId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const deploymentsListRequest = {
          scriptId: project.scriptId!, // Asserted
          pageSize,
          pageToken,
        };
        debug('Requesting script.projects.deployments.list: %O', deploymentsListRequest);
        const response = await scriptService.projects.deployments.list(deploymentsListRequest);
        return {
          results: response.data.deployments ?? [],
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Creates a new deployment or updates an existing one for the current Apps Script project.
   * If `versionNumber` is not provided, a new script version is created with the given `description`.
   * If `deploymentId` is not provided, a new deployment is created. Otherwise, the existing deployment is updated.
   * @param description Optional description for the new version or deployment.
   * @param deploymentId Optional ID of an existing deployment to update.
   * @param versionNumber Optional script version number to deploy.
   * @returns A promise that resolves with the created or updated deployment object.
   */
  async deploy(description = '', deploymentId?: string, versionNumber?: number): Promise<script_v1.Schema$Deployment> {
    debug(
      'Attempting to deploy script ID %s. Deployment ID: %s, Version: %s, Description: "%s"',
      this.scriptId, deploymentId ?? 'New Deployment', versionNumber ?? 'HEAD', description
    );
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    let targetVersionNumber = versionNumber;
    // If no version number is specified, create a new version of the script.
    if (targetVersionNumber === undefined) {
      debug('No version number provided for deployment, creating a new version.');
      targetVersionNumber = await this.version(description); // Use provided description for the new version.
    }

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      if (deploymentId) {
        // Update an existing deployment.
        const updateRequest = {
          scriptId: project.scriptId!, // Asserted
          deploymentId,
          requestBody: {
            deploymentConfig: {
              versionNumber: targetVersionNumber,
              manifestFileName: 'appsscript', // Standard manifest filename.
              description: description ?? '',
            },
          },
        };
        debug('Requesting script.projects.deployments.update: %O', updateRequest.requestBody);
        const response = await scriptService.projects.deployments.update(updateRequest);
        debug('Successfully updated deployment ID: %s', response.data.deploymentId);
        return response.data;
      }
      // Create a new deployment.
      const createRequest = {
        scriptId: project.scriptId!, // Asserted
        requestBody: {
          versionNumber: targetVersionNumber,
          manifestFileName: 'appsscript',
          description: description ?? '',
        },
      };
      debug('Requesting script.projects.deployments.create: %O', createRequest.requestBody);
      const response = await scriptService.projects.deployments.create(createRequest);
      debug('Successfully created new deployment ID: %s', response.data.deploymentId);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Retrieves the entry points for a given deployment of the Apps Script project.
   * Entry points define how the script can be executed (e.g., as a web app, API executable).
   * @param deploymentId The ID of the deployment for which to get entry points.
   * @returns A promise that resolves with an array of entry point objects, or undefined if an error occurs.
   */
  async entryPoints(deploymentId: string): Promise<script_v1.Schema$EntryPoint[] | undefined> {
    debug('Fetching entry points for deployment ID: %s', deploymentId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      const response = await scriptService.projects.deployments.get({
        scriptId: project.scriptId!, // Asserted
        deploymentId,
      });
      return response.data?.entryPoints ?? [];
    } catch (error) {
      return handleApiError(error); // Returns `never`, so effectively throws. Consider if undefined is preferred on error.
    }
  }

  /**
   * Deletes a specific deployment of the Apps Script project.
   * @param deploymentId The ID of the deployment to delete.
   * @returns A promise that resolves when the deployment is deleted, or throws an error.
   */
  async undeploy(deploymentId: string): Promise<void> {
    debug('Attempting to delete deployment ID: %s for script ID: %s', deploymentId, this.scriptId);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, project} = this.options;
    const scriptService = google.script({version: 'v1', auth: credentials});

    try {
      const deleteRequest = {
        scriptId: project.scriptId!, // Asserted
        deploymentId,
      };
      debug('Requesting script.projects.deployments.delete: %O', deleteRequest);
      await scriptService.projects.deployments.delete(deleteRequest);
      debug('Successfully deleted deployment ID: %s', deploymentId);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Writes the current project settings (script ID, root directory, parent ID, GCP project ID,
   * file extensions, push order, and subdirectory skipping preference) to the `.clasp.json` file.
   * @returns A promise that resolves when the settings file has been written.
   */
  async updateSettings(): Promise<void> {
    debug('Updating project settings in .clasp.json at: %s', this.options.configFilePath);
    assertScriptConfigured(this.options); // Ensure scriptId is set before saving.

    const {projectRootDir, contentDir} = this.options.files;
    // Ensure rootDir in .clasp.json is relative to projectRootDir, not an absolute path.
    const relativeRootDir = path.relative(projectRootDir, contentDir);

    const settings = {
      scriptId: this.scriptId, // From getter, asserted by assertScriptConfigured
      rootDir: relativeRootDir || '.', // Use '.' if contentDir is same as projectRootDir
      parentId: this.parentId,
      projectId: this.projectId,
      // Save the actual extensions being used, not just potentially default ones.
      scriptExtensions: this.options.files.fileExtensions['SERVER_JS'],
      htmlExtensions: this.options.files.fileExtensions['HTML'],
      jsonExtensions: this.options.files.fileExtensions['JSON'],
      filePushOrder: this.options.files.filePushOrder ?? [],
      skipSubdirectories: this.options.files.skipSubdirectories ?? false,
    };
    debug('Writing settings to .clasp.json: %O', settings);
    await fs.writeFile(this.options.configFilePath, JSON.stringify(settings, null, 2));
    debug('Project settings updated successfully.');
  }

  /**
   * Sets the GCP project ID for the current Apps Script project and updates the `.clasp.json` settings file.
   * @param projectId The GCP project ID to set. Can be undefined to clear it.
   * @returns A promise that resolves when the project ID has been set and settings saved.
   */
  async setProjectId(projectId: string | undefined): Promise<void> {
    debug('Setting GCP project ID to "%s" in .clasp.json at: %s', projectId, this.options.configFilePath);
    assertScriptConfigured(this.options); // Ensure scriptId is set, as projectId is usually related.
    if (this.options.project) { // Should always be true due to assertScriptConfigured
      this.options.project.projectId = projectId;
    } else {
      // This case should ideally not be reached if assertScriptConfigured works as expected.
      this.options.project = {projectId}; // Initialize if project options were somehow missing.
    }
    await this.updateSettings(); // Persist the change to .clasp.json.
  }

  /**
   * Checks if a `.clasp.json` file (and thus a script ID) is configured for the current context.
   * @returns True if a script ID is set, false otherwise.
   */
  exists(): boolean {
    const scriptIdExists = !!this.options.project?.scriptId;
    debug('Checking if project exists (scriptId is set): %s', scriptIdExists);
    return scriptIdExists;
  }

  /**
   * Reads and parses the `appsscript.json` manifest file from the project's content directory.
   * @returns A promise that resolves with the parsed `Manifest` object.
   * @throws If the script is not configured or the manifest file cannot be read/parsed.
   */
  async readManifest(): Promise<Manifest> {
    debug('Reading project manifest (appsscript.json)...');
    assertScriptConfigured(this.options); // Manifest operations require a configured project.

    const manifestPath = path.join(this.options.files.contentDir, 'appsscript.json');
    debug('Manifest file path: %s', manifestPath);
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent) as Manifest;
      debug('Manifest read and parsed successfully.');
      return manifest;
    } catch (error) {
      debug('Error reading or parsing manifest file: %O', error);
      throw new Error(`Could not read or parse the manifest file at "${manifestPath}": ${error.message}`);
    }
  }
}
