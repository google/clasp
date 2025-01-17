import {google} from 'googleapis';
import open from 'open';

import {PUBLIC_ADVANCED_SERVICES} from '../apis.js';
import {enableOrDisableAPI, getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';

import {OAuth2Client} from 'google-auth-library';
import {URL} from '../urls.js';
import {checkIfOnlineOrDie, getProjectId} from '../utils.js';

type Service = {
  id: string;
  name: string;
  description: string;
};

/**
 * Opens the Google Cloud Console for the project.
 */
export async function openApisCommand() {
  const projectId = await getProjectId();
  const apisUrl = URL.APIS(projectId);
  console.log(apisUrl);
  await open(apisUrl, {wait: false});
}

/**
 * Lists all APIs available to the user and shows which ones are enabled.
 */
export async function listApisCommand() {
  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const projectId = await getProjectId(); // Will prompt user to set up if required

  const printService = (service: Service) =>
    console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);

  console.log('\n# Currently enabled APIs:');
  const enabledApis = await getEnabledApis(oauth2Client, projectId);
  enabledApis.forEach(printService);

  console.log('\n# List of available APIs:');
  const availableApis = await getAvailableApis();
  availableApis.forEach(printService);
}

/**
 * Enable a service.
 *
 * @param serviceName The name of the service to enable
 */
export async function enableApiCommand(serviceName: string) {
  await enableOrDisableAPI(serviceName, true);
}

/**
 * Disable a service.
 *
 * @param serviceName The name of the service to disable
 */
export async function disableApiCommand(serviceName: string) {
  await enableOrDisableAPI(serviceName, false);
}

/**
 * Fetch the enabled APIs for the given project.
 *
 * @param projectId project to get APIs for
 * @param oauth2Client authorized oauth2 client
 * @returns list of enabled APIs
 */
async function getEnabledApis(oauth2Client: OAuth2Client, projectId: string): Promise<Array<Service>> {
  const serviceUsage = google.serviceusage({version: 'v1', auth: oauth2Client});

  const list = await serviceUsage.services.list({
    parent: `projects/${projectId}`,
    filter: 'state:ENABLED',
    pageSize: 200,
  });
  const serviceList = list.data.services ?? [];

  // Filter out the disabled ones. Print the enabled ones.
  const truncateName = (name: string) => name.slice(0, name.indexOf('.'));
  return serviceList
    .filter(service => service.state === 'ENABLED')
    .map(service => ({
      id: service.name ?? '',
      name: truncateName(service.config?.name ?? 'Unknown name'),
      description: service.config?.documentation?.summary ?? '',
    }));
}

/**
 * Fetch the available APIs for the given project.
 *
 * @returns list of available APIs
 */
async function getAvailableApis(): Promise<Array<Service>> {
  const discovery = google.discovery({version: 'v1'});

  const {data} = await discovery.apis.list({
    preferred: true,
  });

  const allServices = data.items ?? [];
  return PUBLIC_ADVANCED_SERVICES.map(service => allServices.find(s => s?.name === service.serviceId))
    .filter((service): service is Service => service?.id !== undefined && service?.description !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));
}
