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
 * @fileoverview Manages Google API services for an Apps Script project.
 * This includes listing currently enabled services, listing all available
 * advanced services, and enabling or disabling services for the project.
 * Enabling/disabling involves both updating the local `appsscript.json` manifest
 * and making calls to the Google Service Usage API.
 */

import path from 'path';
import Debug from 'debug';
import fs from 'fs/promises';
import {google} from 'googleapis';

import {PUBLIC_ADVANCED_SERVICES} from './apis.js';
import type {Manifest} from './manifest.js';
import {ClaspOptions, assertGcpProjectConfigured, handleApiError} from './utils.js';
import {fetchWithPages} from './utils.js';

const debug = Debug('clasp:core');

/**
 * Represents a Google API service with its identifier, common name, and description.
 */
export type Service = {
  /** The full identifier of the service, often including '.googleapis.com'. */
  id: string;
  /** The common name of the service (e.g., 'drive', 'sheets'). */
  name: string;
  /** A brief description of the service. */
  description: string;
};

/**
 * Manages Google API services for an Apps Script project, including listing,
 * enabling, and disabling services.
 */
export class Services {
  private options: ClaspOptions;

  /**
   * Constructs a Services manager instance.
   * @param options The Clasp configuration options.
   */
  constructor(options: ClaspOptions) { // Renamed parameter for clarity
    this.options = options;
  }

  /**
   * Retrieves a list of Google APIs currently enabled for the associated GCP project.
   * Filters this list to include only those services recognized as Apps Script Advanced Services.
   * @returns A promise that resolves to an array of `Service` objects representing enabled advanced services.
   */
  async getEnabledServices(): Promise<Service[]> {
    debug('Fetching enabled Google API services for the project...');
    assertGcpProjectConfigured(this.options); // Requires GCP project linkage.

    const {projectId} = this.options.project; // projectId is asserted by assertGcpProjectConfigured
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});

    try {
      // Fetch all enabled services from GCP Service Usage API.
      const serviceListResponse = await fetchWithPages(
        async (pageSize, pageToken) => {
          const request = {
            parent: `projects/${projectId!}`, // Assert projectId is not undefined
            filter: 'state:ENABLED', // Only fetch enabled services.
            pageSize,
            pageToken,
          };
          debug('Requesting enabled services: %O', request);
          const response = await serviceUsage.services.list(request);
          return {
            results: response.data.services ?? [],
            nextPageToken: response.data.nextPageToken ?? undefined,
          };
        },
        {pageSize: 200, maxResults: 10000}, // Sensible defaults for service listing.
      );

      // Helper to extract the simple name (e.g., 'drive' from 'drive.googleapis.com').
      const truncateServiceName = (fullServiceName: string): string => {
        const dotIndex = fullServiceName.indexOf('.');
        return dotIndex !== -1 ? fullServiceName.substring(0, dotIndex) : fullServiceName;
      };

      // Filter the list of all enabled services to only include those known as Apps Script Advanced Services.
      const advancedServiceIds = new Set(PUBLIC_ADVANCED_SERVICES.map(service => service.serviceId));
      const enabledAdvancedServices = serviceListResponse.results
        .map(gcpService => ({
          id: gcpService.name ?? 'Unknown ID', // Full resource name like 'projects/xxx/services/drive.googleapis.com'
          name: truncateServiceName(gcpService.config?.name ?? 'Unknown name'), // e.g., 'drive'
          description: gcpService.config?.documentation?.summary ?? 'No description available.',
        }))
        .filter(service => advancedServiceIds.has(service.name)); // Match against our known list by simple name.

      debug(`Found ${enabledAdvancedServices.length} enabled Advanced Services for Apps Script.`);
      return enabledAdvancedServices;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Retrieves a list of all Google APIs available to be enabled as Advanced Services in Apps Script.
   * This list is based on the `PUBLIC_ADVANCED_SERVICES` constant.
   * @returns A promise that resolves to an array of `Service` objects.
   */
  async getAvailableServices(): Promise<Service[]> {
    debug('Fetching list of all available Advanced Services for Apps Script...');
    // This method currently relies on a predefined list (PUBLIC_ADVANCED_SERVICES)
    // rather than making a dynamic discovery call for all *possible* services,
    // as the manifest and Apps Script environment only support a specific subset.
    // The `google.discovery('v1').apis.list` could be used for a broader list,
    // but it would require more complex filtering to match what's usable in Apps Script.

    // Transform the predefined list into the `Service` type format.
    const availableServices = PUBLIC_ADVANCED_SERVICES.map(advService => ({
      id: advService.serviceId, // Using serviceId as the primary identifier here.
      name: advService.serviceId, // Consistent with how serviceId is used as 'name' elsewhere.
      // Attempt to find a more descriptive name/description if available from a broader discovery,
      // but for now, use serviceId and a generic description.
      description: `Enable ${advService.userSymbol} (version ${advService.version}) as an Advanced Service.`,
    }));

    availableServices.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name.
    debug(`Returning ${availableServices.length} available Advanced Services based on predefined list.`);
    return availableServices;
  }

  /**
   * Enables a specified Google API service for the Apps Script project.
   * This involves updating the `appsscript.json` manifest locally and enabling
   * the corresponding service in the linked Google Cloud Platform project.
   * @param serviceName The simple name of the service to enable (e.g., 'sheets', 'drive').
   * @returns A promise that resolves when the service is successfully enabled.
   */
  async enableService(serviceName: string): Promise<void> {
    debug('Attempting to enable service: %s', serviceName);
    assertGcpProjectConfigured(this.options); // Requires GCP project linkage.

    const {projectId} = this.options.project; // projectId is asserted.
    const {contentDir} = this.options.files;

    if (!serviceName) {
      throw new Error('A service name must be provided to enable an API.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    if (!(await hasReadWriteAccess(manifestPath))) {
      debug('Manifest file (%s) does not exist or is not accessible.', manifestPath);
      throw new Error(`Manifest file (appsscript.json) not found or not accessible in "${contentDir}".`);
    }

    // Find the service details from our predefined list.
    const advancedService = PUBLIC_ADVANCED_SERVICES.find(service => service.serviceId === serviceName);
    if (!advancedService) {
      throw new Error(`Service "${serviceName}" is not a recognized Apps Script Advanced Service.`);
    }

    // Update the local appsscript.json manifest.
    debug('Updating manifest to enable service: %s', advancedService.userSymbol);
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest: Manifest = JSON.parse(manifestContent);

    manifest.dependencies = manifest.dependencies ?? {};
    manifest.dependencies.enabledAdvancedServices = manifest.dependencies.enabledAdvancedServices ?? [];

    // Add the service if it's not already listed.
    if (!manifest.dependencies.enabledAdvancedServices.some(s => s.userSymbol === advancedService.userSymbol)) {
      manifest.dependencies.enabledAdvancedServices.push(advancedService);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      debug('Manifest updated successfully.');
    } else {
      debug('Service %s already enabled in the manifest.', advancedService.userSymbol);
    }

    // Enable the service in the GCP project.
    const gcpServiceName = `${serviceName}.googleapis.com`; // e.g., "drive.googleapis.com"
    debug('Enabling GCP service: %s for project %s', gcpServiceName, projectId);
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId!}/services/${gcpServiceName}`; // projectId is asserted.
    try {
      await serviceUsage.services.enable({name: resourceName});
      debug('GCP service %s enabled successfully.', gcpServiceName);
    } catch (error) {
      // Note: If this fails, the manifest has already been updated.
      // Consider how to handle this inconsistency (e.g., revert manifest change or inform user).
      return handleApiError(error);
    }
  }

  /**
   * Disables a specified Google API service for the Apps Script project.
   * This involves updating the `appsscript.json` manifest locally and disabling
   * the corresponding service in the linked Google Cloud Platform project.
   * @param serviceName The simple name of the service to disable (e.g., 'sheets', 'drive').
   * @returns A promise that resolves when the service is successfully disabled.
   */
  async disableService(serviceName: string): Promise<void> {
    debug('Attempting to disable service: %s', serviceName);
    assertGcpProjectConfigured(this.options); // Requires GCP project linkage.

    const {projectId} = this.options.project; // projectId is asserted.
    const {contentDir} = this.options.files;

    if (!serviceName) {
      throw new Error('A service name must be provided to disable an API.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    if (!(await hasReadWriteAccess(manifestPath))) {
      debug('Manifest file (%s) does not exist or is not accessible.', manifestPath);
      throw new Error(`Manifest file (appsscript.json) not found or not accessible in "${contentDir}".`);
    }

    // Update the local appsscript.json manifest.
    debug('Updating manifest to disable service: %s', serviceName);
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest: Manifest = JSON.parse(manifestContent);

    if (manifest.dependencies?.enabledAdvancedServices) {
      const initialLength = manifest.dependencies.enabledAdvancedServices.length;
      manifest.dependencies.enabledAdvancedServices = manifest.dependencies.enabledAdvancedServices.filter(
        service => service.serviceId !== serviceName,
      );
      if (manifest.dependencies.enabledAdvancedServices.length < initialLength) {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        debug('Manifest updated successfully.');
      } else {
        debug('Service %s not found in manifest, no update needed.', serviceName);
      }
    } else {
      debug('No advanced services enabled in manifest, skipping manifest update for disabling %s.', serviceName);
    }

    // Disable the service in the GCP project.
    const gcpServiceName = `${serviceName}.googleapis.com`;
    debug('Disabling GCP service: %s for project %s', gcpServiceName, projectId);
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId!}/services/${gcpServiceName}`; // projectId is asserted.
    try {
      await serviceUsage.services.disable({name: resourceName});
      debug('GCP service %s disabled successfully.', gcpServiceName);
    } catch (error) {
      // Note: If this fails, the manifest has already been updated.
      // Consider how to handle this inconsistency.
      return handleApiError(error);
    }
  }
}

/**
 * Checks if the current process has read and write access to the given path.
 * @param filePath The path to check.
 * @returns A promise that resolves with true if readable and writable, false otherwise.
 */
async function hasReadWriteAccess(filePath: string): Promise<boolean> {
  try {
    await fs.access(path, fs.constants.W_OK | fs.constants.R_OK);
  } catch {
    return false;
  }
  return true;
}
