import {discovery_v1 as discoveryV1, serviceusage_v1 as serviceUsageV1} from 'googleapis';
import open from 'open';
import type {ReadonlyDeep} from 'type-fest';

import {PUBLIC_ADVANCED_SERVICES} from '../apis.js';
import {enableOrDisableAPI} from '../apiutils.js';
import {discovery, loadAPICredentials, serviceUsage} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {ERROR} from '../messages.js';
import {URL} from '../urls.js';
import {getProjectId} from '../utils.js';

type DirectoryItem = Unpacked<discoveryV1.Schema$DirectoryList['items']>;
type PublicAdvancedService = ReadonlyDeep<Required<NonNullable<DirectoryItem>>>;

interface CommandOption {
  readonly open?: string;
}

/**
 * Acts as a router to apis subcommands
 * Calls functions for list, enable, or disable
 * Otherwise returns an error of command not supported
 */
export default async (options: CommandOption): Promise<void> => {
  await loadAPICredentials();

  // clasp apis --open
  if (options.open) {
    return openApiUrl();
  }

  const [_bin, _sourcePath, ...args] = process.argv;
  const [_command, subCommand, serviceName] = args;

  // The apis subcommands.
  const apiSubCommands: Record<string, () => Promise<void>> = {
    disable: async () => enableOrDisableAPI(serviceName, false),
    enable: async () => enableOrDisableAPI(serviceName, true),
    list: async () => {
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
        (service: Readonly<serviceUsageV1.Schema$GoogleApiServiceusageV1Service>) => service.state === 'ENABLED'
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
    },
    undefined: async () => {
      await apiSubCommands.list();
      console.log(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
    },
  };

  if (subCommand in apiSubCommands) {
    await apiSubCommands[subCommand]();
    return;
  }

  throw new ClaspError(ERROR.COMMAND_DNE(`apis ${subCommand}`));
};

const openApiUrl = async () => {
  const apisUrl = URL.APIS(await getProjectId());
  console.log(apisUrl);
  await open(apisUrl, {wait: false});
};
