/* eslint-disable new-cap,@typescript-eslint/prefer-readonly-parameter-types */
import {GaxiosResponse} from 'gaxios';
import {serviceusage_v1 as serviceUsageV1} from 'googleapis';
import open from 'open';

import {PUBLIC_ADVANCED_SERVICES} from '../apis';
import {enableOrDisableAPI} from '../apiutils';
import {discovery, loadAPICredentials, serviceUsage} from '../auth';
import {ERROR} from '../messages';
import {URL} from '../urls';
import {checkIfOnline, getProjectId, logError} from '../utils';

/**
 * Acts as a router to apis subcommands
 * Calls functions for list, enable, or disable
 * Otherwise returns an error of command not supported
 */
export default async (options: {readonly open?: string}): Promise<void> => {
  await loadAPICredentials();
  const subcommand: string = process.argv[3]; // Clasp apis list => "list"
  const serviceName = process.argv[4]; // Clasp apis enable drive => "drive"

  // clasp apis --open
  if (options.open) {
    const apisUrl = URL.APIS(await getProjectId());
    console.log(apisUrl);
    await open(apisUrl, {wait: false});
    return;
  }

  // The apis subcommands.
  const command: {[key: string]: () => void} = {
    enable: async () => {
      await enableOrDisableAPI(serviceName, true);
    },
    disable: async () => {
      await enableOrDisableAPI(serviceName, false);
    },
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
      const services = data.items ?? [];
      // Only get the public service IDs
      const PUBLIC_ADVANCED_SERVICE_IDS = PUBLIC_ADVANCED_SERVICES.map(advancedService => advancedService.serviceId);

      // Merge discovery data with public services data.
      const publicServices = [];
      for (const publicServiceId of PUBLIC_ADVANCED_SERVICE_IDS) {
        const service = services.find(s => s.name === publicServiceId);
        // For some reason 'youtubePartner' is not in the api list.
        if (service?.id && service.description) {
          publicServices.push(service);
        }
      }

      // Sort the services based on id
      publicServices.sort((a: any, b: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (a.id < b.id) return -1;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (a.id > b.id) return 1;
        return 0;
      });

      // Format the list
      for (const api of publicServices) {
        console.log(`${api.name!.padEnd(25)} - ${api.description!.padEnd(60)}`);
      }
    },
    undefined: () => {
      command.list();

      console.log(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
    },
  };
  if (command[subcommand]) {
    command[subcommand]();
  } else {
    logError(null, ERROR.COMMAND_DNE(`apis ${subcommand}`));
  }
};
