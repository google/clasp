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
  getProjectId(): string | undefined {
    assertScriptConfigured(this.options);
    return this.options.project.projectId;
  }

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

  async createWithContainer(name: string, mimeType: string): Promise<{scriptId: string; parentId: string}> {
    debug('Creating container bound script %s (%s)', name, mimeType);
    assertAuthenticated(this.options);

    if (this.options.project?.scriptId) {
      debug('Warning: Creating script while id already exists');
    }

    let parentId: string | null | undefined;

    const credentials = this.options.credentials;
    const drive = google.drive({version: 'v3', auth: credentials});
    try {
      const requestOptions = {
        requestBody: {
          mimeType,
          name,
        },
      };
      debug('Creating project with request %O', requestOptions);
      const res = await drive.files.create(requestOptions);
      parentId = res.data.id;
      debug('Created container %s', parentId);
      if (!parentId) {
        throw new Error('Unexpected error, container ID missing from response.');
      }
    } catch (error) {
      handleApiError(error);
    }

    const scriptId = await this.createScript(name, parentId);
    return {
      parentId,
      scriptId,
    };
  }

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

  async deploy(description = '', deploymentId?: string, versionNumber?: number): Promise<script_v1.Schema$Deployment> {
    debug('Deploying project: %s (%s)', description, versionNumber ?? 'HEAD');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    if (versionNumber === undefined) {
      versionNumber = await this.version(description);
    }

    const scriptId = this.options.project.scriptId;
    const credentials = this.options.credentials;

    const script = google.script({version: 'v1', auth: credentials});

    try {
      let deployment: script_v1.Schema$Deployment | undefined;
      if (!deploymentId) {
        const requestOptions = {
          scriptId: scriptId,
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
        const requestOptions = {
          scriptId: scriptId,
          deploymentId: deploymentId,
          requestBody: {
            deploymentConfig: {
              description: description ?? '',
              versionNumber: versionNumber,
              scriptId: scriptId,
              manifestFileName: 'appsscript',
            },
          },
        };
        debug('Updating existing deployment with request %O', requestOptions);
        const res = await script.projects.deployments.update(requestOptions);
        deployment = res.data;
      }
      return deployment;
    } catch (error) {
      handleApiError(error);
    }
  }

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

  async updateSettings(): Promise<void> {
    debug('Updating settings');
    assertScriptConfigured(this.options);

    const srcDir = path.relative(this.options.files.projectRootDir, this.options.files.contentDir);
    const settings = {
      scriptId: this.options.project.scriptId,
      rootDir: srcDir,
      projectId: this.options.project.projectId,
      scriptExtensions: this.options.files.fileExtensions['SERVER_JS'],
      htmlExtensions: this.options.files.fileExtensions['HTML'],
      jsonExtensions: this.options.files.fileExtensions['JSON'],
      filePushOrder: [],
    };
    await fs.writeFile(this.options.configFilePath, JSON.stringify(settings, null, 2));
  }

  async setProjectId(projectId: string | undefined): Promise<void> {
    debug('Setting project ID %s in file %s', projectId, this.options.configFilePath);
    assertScriptConfigured(this.options);
    this.options.project.projectId = projectId;
    this.updateSettings();
  }

  exists(): boolean {
    return this.options.project?.scriptId !== undefined;
  }

  async readManifest(): Promise<Manifest> {
    debug('Reading manifest');
    assertScriptConfigured(this.options);
    const manifestPath = path.join(this.options.files.contentDir, 'appsscript.json');
    debug('Manifest path is %s', manifestPath);
    const content = await fs.readFile(manifestPath);
    const manifest: Manifest = JSON.parse(content.toString());
    return manifest;
  }
}
