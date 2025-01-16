import {discovery_v1 as discoveryV1, google, serviceusage_v1 as serviceUsageV1} from 'googleapis';
import open from 'open';
import type {ReadonlyDeep} from 'type-fest';

import {PUBLIC_ADVANCED_SERVICES} from '../apis.js';
import {enableOrDisableAPI} from '../apiutils.js';
import {getAuthorizedOAuth2Client} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {ERROR} from '../messages.js';
import {URL} from '../urls.js';
import {getProjectId} from '../utils.js';

type Unpacked<T> = T extends Array<infer U> ? U : T;
type DirectoryItem = Unpacked<discoveryV1.Schema$DirectoryList['items']>;
type PublicAdvancedService = ReadonlyDeep<Required<NonNullable<DirectoryItem>>>;

export async function openApisCommand() {
  const projectId = await getProjectId();
  const apisUrl = URL.APIS(projectId);
  console.log(apisUrl);
  await open(apisUrl, {wait: false});
}

export async function listApisCommand() {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }

  const serviceUsage = google.serviceusage({version: 'v1', auth: oauth2Client});
  const discovery = google.discovery({version: 'v1'});

  /**
   * List currently enabled APIs.
   */
  console.log('\n# Currently enabled APIs:');
  const projectId = await getProjectId(); // Will prompt user to set up if required
  const MAX_PAGE_SIZE = 200; // This is the max page size according to the docs.
  const list = await serviceUsage.services.list({
    parent: `projects/${projectId}`,
    filter: 'state:ENABLED',
    pageSize: MAX_PAGE_SIZE,
  });
  const serviceList = list.data.services ?? [];
  if (serviceList.length >= MAX_PAGE_SIZE) {
    console.log('There is a bug with pagination. Please file an issue on Github.');
  }

  // Filter out the disabled ones. Print the enabled ones.
  const enabledAPIs = serviceList.filter(
    (service: Readonly<serviceUsageV1.Schema$GoogleApiServiceusageV1Service>) => service.state === 'ENABLED',
  );
  for (const {config} of enabledAPIs) {
    if (config?.documentation) {
      const name = config.name ?? 'Unknown name.';
      console.log(`${name.slice(0, name.indexOf('.'))} - ${config.documentation.summary!}`);
    }
  }

  /**
   * List available APIs.
   */
  console.log('\n# List of available APIs:');
  const {data} = await discovery.apis.list({
    preferred: true,
  });

  const services: DirectoryItem[] = data.items ?? [];
  // Only get the public service IDs
  const publicAdvancedServicesIds = PUBLIC_ADVANCED_SERVICES.map(advancedService => advancedService.serviceId);

  // Merge discovery data with public services data.
  const publicServices = publicAdvancedServicesIds
    .map(publicServiceId => services.find(s => s?.name === publicServiceId) as PublicAdvancedService)
    .filter(service => service?.id && service.description);

  // Sort the services based on id
  publicServices.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));

  // Format the list
  for (const service of publicServices) {
    console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
  }
}

export async function enableApiCommand(serviceName: string) {
  await enableOrDisableAPI(serviceName, true);
}

export async function disableApiCommand(serviceName: string) {
  await enableOrDisableAPI(serviceName, false);
}
