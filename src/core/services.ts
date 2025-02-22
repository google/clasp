import path from 'path';
import Debug from 'debug';
import fs from 'fs-extra';
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

export class Services {
  private options: ClaspOptions;

  constructor(config: ClaspOptions) {
    this.options = config;
  }

  async getEnabledServices() {
    debug('Fetching enabled services');
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});

    try {
      const serviceList = await fetchWithPages(async (pageSize, pageToken) => {
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
      });

      // Filter out the disabled ones. Print the enabled ones.
      const truncateName = (name: string) => name.slice(0, name.indexOf('.'));
      return serviceList.results
        .filter(service => service.state === 'ENABLED')
        .map(service => ({
          id: service.name ?? '',
          name: truncateName(service.config?.name ?? 'Unknown name'),
          description: service.config?.documentation?.summary ?? '',
        }));
    } catch (error) {
      handleApiError(error);
    }
  }

  async getAvailableServices() {
    debug('Fetching available services');
    const discovery = google.discovery({version: 'v1'});

    try {
      const {data} = await discovery.apis.list({
        preferred: true,
      });

      const allServices = data.items ?? [];
      return PUBLIC_ADVANCED_SERVICES.map(service => allServices.find(s => s?.name === service.serviceId))
        .filter((service): service is Service => service?.id !== undefined && service?.description !== undefined)
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      handleApiError(error);
    }
  }

  async enableService(serviceName: string): Promise<void> {
    debug('Enabling service %s', serviceName);
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const contentDir = this.options.files.contentDir;

    if (!serviceName) {
      throw new Error('No service name provided.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    const manifestExists = fs.exists(manifestPath);
    if (!manifestExists) {
      debug('Manifest file at %s does not exist', manifestPath);
      throw new Error('Manifest file does not exist.');
    }

    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId}/services/${serviceName}.googleapis.com`;
    try {
      await serviceUsage.services.enable({name: resourceName});

      const advancedService = PUBLIC_ADVANCED_SERVICES.find(service => service.serviceId === serviceName);
      if (!advancedService) {
        // Do not update manifest if not valid advanced service
        debug('Service is not an advanced service, skipping manifest update');
        return;
      }
      const manifest: Manifest = await fs.readJson(manifestPath);
      if (manifest.dependencies?.enabledAdvancedServices) {
        if (
          manifest.dependencies.enabledAdvancedServices.findIndex(s => s.userSymbol === advancedService.userSymbol) ===
          -1
        ) {
          manifest.dependencies.enabledAdvancedServices.push(advancedService);
        }
      } else if (manifest.dependencies) {
        manifest.dependencies.enabledAdvancedServices = [advancedService];
      } else {
        manifest.dependencies = {enabledAdvancedServices: [advancedService]};
      }

      debug('Updating manifest at %s with %j', manifestPath, manifest);
      await fs.writeJson(manifestPath, manifest, {spaces: 2});
    } catch (error) {
      handleApiError(error);
    }
  }

  async disableService(serviceName: string): Promise<void> {
    debug('Disabling service %s', serviceName);

    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const contentDir = this.options.files.contentDir;

    if (!serviceName) {
      throw new Error('No service name provided.');
    }

    const manifestPath = path.join(contentDir, 'appsscript.json');
    const manifestExists = fs.exists(manifestPath);
    if (!manifestExists) {
      debug('Manifest file at %s does not exist', manifestPath);
      throw new Error('Manifest file does not exist.');
    }

    const serviceUsage = google.serviceusage({version: 'v1', auth: this.options.credentials});
    const resourceName = `projects/${projectId}/services/${serviceName}.googleapis.com`;
    try {
      await serviceUsage.services.disable({name: resourceName});

      const advancedService = PUBLIC_ADVANCED_SERVICES.find(service => service.serviceId === serviceName);
      if (!advancedService) {
        // Do not update manifest if not valid advanced service
        debug('Service is not an advanced service, skipping manifest update');
        return;
      }
      const manifest: Manifest = await fs.readJson(manifestPath);
      if (!manifest.dependencies?.enabledAdvancedServices) {
        debug('Service enabled in manifest, skipping manifest update');
        return;
      }
      manifest.dependencies.enabledAdvancedServices = manifest.dependencies.enabledAdvancedServices.filter(
        service => service.serviceId !== serviceName,
      );
      debug('Updating manifest at %s with %j', manifestPath, manifest);
      await fs.writeJson(manifestPath, manifest, {spaces: 2});
    } catch (error) {
      handleApiError(error);
    }
  }
}
