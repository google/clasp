import {GaxiosResponse} from 'gaxios';
import {discovery_v1 as discoveryV1, serviceusage_v1 as serviceUsageV1} from 'googleapis';
import open from 'open';
import {ReadonlyDeep} from 'type-fest';

import {PUBLIC_ADVANCED_SERVICES} from '../apis';
import {enableOrDisableAPI} from '../apiutils';
import {discovery, loadAPICredentials, serviceUsage} from '../auth';
import {ClaspError} from '../clasp-error';
import {ERROR} from '../messages';
import {URL} from '../urls';
import {checkIfOnline, getProjectId} from '../utils';

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
    return await openApiUrl();
  }

  // @ts-expect-error
  const [bin, sourcePath, ...args] = process.argv;
  // @ts-expect-error
  const [command, subCommand, serviceName] = args;
  // const subCommand: string = process.argv[3]; // Clasp apis list => "list"
  // const serviceName = process.argv[4]; // Clasp apis enable drive => "drive"

  // The apis subcommands.
  const apiSubCommands: {[key: string]: () => Promise<void>} = {
    disable: async () => enableOrDisableAPI(serviceName, false),
    enable: async () => enableOrDisableAPI(serviceName, true),
    list: async () => {
      await checkIfOnline();
      /**
       * List currently enabled APIs.
       */
      console.log('\n# Currently enabled APIs:');
      const projectId = await getProjectId(); // Will prompt user to set up if required
      const MAX_PAGE_SIZE = 200; // This is the max page size according to the docs.
      const list: GaxiosResponse<serviceUsageV1.Schema$ListServicesResponse> = await serviceUsage.services.list({
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
      for (const enabledAPI of enabledAPIs) {
        if (enabledAPI.config && enabledAPI.config.documentation) {
          const name = enabledAPI.config.name ?? 'Unknown name.';
          console.log(`${name.slice(0, name.indexOf('.'))} - ${enabledAPI.config.documentation.summary}`);
        }
      }

      /**
       * List available APIs.
       */
      console.log('\n# List of available APIs:');
      const {data} = await discovery.apis.list({
        preferred: true,
      });

      type DirectoryItem = Unpacked<discoveryV1.Schema$DirectoryList['items']>;
      type PublicAdvancedService = ReadonlyDeep<Required<NonNullable<DirectoryItem>>>;

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
      publicServices.forEach(service => console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`));
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
