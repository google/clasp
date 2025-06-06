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

// This file defines the `Services` class, which handles the management of
// Google Cloud Platform (GCP) services and Advanced Google Services for an
// Apps Script project, including enabling, disabling, and listing services.

import path from 'path';
import Debug from 'debug';
import fs from 'fs/promises';
import {google} from 'googleapis';

import {PUBLIC_ADVANCED_SERVICES} from './apis.js';
import type {Manifest} from './manifest.js';
import {ClaspOptions, assertGcpProjectConfigured, handleApiError} from './utils.js';
import {fetchWithPages} from './utils.js';

const debug = Debug('clasp:core');

export type Service = {
  id: string;
  name: string;
  description: string;
};

/**
 * Manages the Google Cloud Platform (GCP) services and Advanced Google Services
 * associated with an Apps Script project. This includes listing available and
 * enabled services, as well as enabling or disabling services for the project.
 */
export class Services {
  private options: ClaspOptions;

  constructor(config: ClaspOptions) {
    this.options = config;
  }

  /**
   * Retrieves a list of Google Cloud Platform (GCP) services that are currently
   * enabled for the associated Apps Script project.
   * @returns {Promise<Service[] | undefined>} A promise that resolves to an array of enabled
   * services (with id, name, and description), or undefined if an error occurs.
   * Filters for services that are also listed as public advanced services.
   * @throws {Error} If the GCP project is not configured or authentication fails.
   */
  async getEnabledServices() {
    debug('Fetching enabled services');
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});

    try {
      const serviceList = await fetchWithPages(
        async (pageSize, pageToken) => {
          const requestOptions = {
            parent: `projects/${projectId}`,
            filter: 'state:ENABLED',
            pageSize,
            pageToken,
          };
          debug('Fetching available APIs with request %O', requestOptions);
          const res = await serviceUsage.services.list(requestOptions);
          return {
            results: res.data.services ?? [],
            pageToken: res.data.nextPageToken ?? undefined,
          };
        },
        {
          pageSize: 200,
          maxResults: 10000,
        },
      );

      // Filter out the disabled ones. Print the enabled ones.
      const truncateName = (name: string) => {
        const i = name.indexOf('.');
        if (i !== -1) {
          return name.slice(0, i);
        }
        return name;
      };
      const allowedIds = PUBLIC_ADVANCED_SERVICES.map(service => service.serviceId);
      return serviceList.results
        .map(service => ({
          id: service.name ?? '',
          name: truncateName(service.config?.name ?? 'Unknown name'),
          description: service.config?.documentation?.summary ?? '',
        }))
        .filter(service => {
          return allowedIds.indexOf(service.name) !== -1;
        });
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Retrieves a list of all publicly available Google Advanced Services that can be
   * enabled for an Apps Script project.
   * @returns {Promise<Service[] | undefined>} A promise that resolves to an array of available
   * services (with id, name, and description), or undefined if an error occurs.
   * @throws {Error} If there's an API error.
   */
  async getAvailableServices() {
    debug('Fetching available services');
    const discovery = google.discovery({version: 'v1'});

    try {
      const {data} = await discovery.apis.list({
        preferred: true,
      });
      const allowedIds = PUBLIC_ADVANCED_SERVICES.map(service => service.serviceId);
      const allServices = data.items ?? [];
      const isValidService = (s: any): s is Service => {
        return (
          s.id !== undefined && s.name !== undefined && allowedIds.indexOf(s.name) !== -1 && s.description !== undefined
        );
      };
      const services = allServices.filter(isValidService).sort((a, b) => a.id.localeCompare(b.id));
      debug('Available services: %O', services);
      return services;
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Enables a specified Google Advanced Service for the Apps Script project.
   * This involves two steps:
   * 1. Enabling the corresponding service in the Google Cloud Platform (GCP) project.
   * 2. Updating the `appsscript.json` manifest file to include the service in its dependencies.
   * @param {string} serviceName - The service ID (e.g., 'sheets', 'docs') of the service to enable.
   * @returns {Promise<void>} A promise that resolves when the service is enabled.
   * @throws {Error} If the service name is not provided, the manifest file doesn't exist,
   * the service is not a valid advanced service, or if there's an API error or
   * authentication/configuration issue.
   */
  async enableService(serviceName: string): Promise<void> {
    debug('Enabling service %s', serviceName);
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const contentDir = this.options.files.contentDir;

    if (!serviceName) {
      throw new Error('No service name provided.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    const manifestExists = await hasReadWriteAccess(manifestPath);
    if (!manifestExists) {
      debug('Manifest file at %s does not exist', manifestPath);
      throw new Error('Manifest file does not exist.');
    }

    const advancedService = PUBLIC_ADVANCED_SERVICES.find(service => service.serviceId === serviceName);
    if (!advancedService) {
      throw new Error('Service is not a valid advanced service.');
    }

    // Do not update manifest if not valid advanced service
    debug('Service is an advanced service, updating manifest');
    const content = await fs.readFile(manifestPath);
    const manifest: Manifest = JSON.parse(content.toString());
    if (manifest.dependencies?.enabledAdvancedServices) {
      if (
        manifest.dependencies.enabledAdvancedServices.findIndex(s => s.userSymbol === advancedService.userSymbol) === -1
      ) {
        manifest.dependencies.enabledAdvancedServices.push(advancedService);
      }
    } else if (manifest.dependencies) {
      manifest.dependencies.enabledAdvancedServices = [advancedService];
    } else {
      manifest.dependencies = {enabledAdvancedServices: [advancedService]};
    }

    debug('Updating manifest at %s with %j', manifestPath, manifest);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    debug('Enabling GCP service %s.googleapis.com', serviceName);
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId}/services/${serviceName}.googleapis.com`;
    try {
      await serviceUsage.services.enable({name: resourceName});
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Disables a specified Google Advanced Service for the Apps Script project.
   * This involves two steps:
   * 1. Disabling the corresponding service in the Google Cloud Platform (GCP) project.
   * 2. Removing the service from the `appsscript.json` manifest file's dependencies.
   * @param {string} serviceName - The service ID (e.g., 'sheets', 'docs') of the service to disable.
   * @returns {Promise<void>} A promise that resolves when the service is disabled.
   * @throws {Error} If the service name is not provided, the manifest file doesn't exist,
   * the service is not a valid advanced service, or if there's an API error or
   * authentication/configuration issue.
   */
  async disableService(serviceName: string): Promise<void> {
    debug('Disabling service %s', serviceName);

    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const contentDir = this.options.files.contentDir;

    if (!serviceName) {
      throw new Error('No service name provided.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    const manifestExists = await hasReadWriteAccess(manifestPath);
    if (!manifestExists) {
      debug('Manifest file at %s does not exist', manifestPath);
      throw new Error('Manifest file does not exist.');
    }

    const advancedService = PUBLIC_ADVANCED_SERVICES.find(service => service.serviceId === serviceName);
    if (!advancedService) {
      throw new Error('Service is not a valid advanced service.');
    }
    // Do not update manifest if not valid advanced service
    debug('Service is an advanced service, updating manifest');
    const content = await fs.readFile(manifestPath);
    const manifest: Manifest = JSON.parse(content.toString());
    if (!manifest.dependencies?.enabledAdvancedServices) {
      debug('Service enabled in manifest, skipping manifest update');
      return;
    }
    manifest.dependencies.enabledAdvancedServices = manifest.dependencies.enabledAdvancedServices.filter(
      service => service.serviceId !== serviceName,
    );
    debug('Updating manifest at %s with %j', manifestPath, manifest);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    debug('Disabling GCP service %s.googleapis.com', serviceName);
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId}/services/${serviceName}.googleapis.com`;
    try {
      await serviceUsage.services.disable({name: resourceName});
    } catch (error) {
      handleApiError(error);
    }
  }
}

async function hasReadWriteAccess(path: string) {
  try {
    await fs.access(path, fs.constants.W_OK | fs.constants.R_OK);
  } catch {
    return false;
  }
  return true;
}
