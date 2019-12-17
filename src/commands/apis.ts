import { ERROR, checkIfOnline, getProjectId, logError } from '../utils';
import { discovery, loadAPICredentials, serviceUsage } from '../auth';

import { GaxiosResponse } from 'gaxios';
import { PUBLIC_ADVANCED_SERVICES } from '../apis';
import { URL } from '../urls';
import { enableOrDisableAPI } from '../apiutils';
import open from 'open';
import { serviceusage_v1 } from 'googleapis';

/**
 * Acts as a router to apis subcommands
 * Calls functions for list, enable, or disable
 * Otherwise returns an error of command not supported
 */
export default async (options: { open?: string }) => {
  await loadAPICredentials();
  const subcommand: string = process.argv[3]; // clasp apis list => "list"
  const serviceName = process.argv[4]; // clasp apis enable drive => "drive"

  // clasp apis --open
  if (options.open) {
    const apisUrl = URL.APIS(await getProjectId());
    console.log(apisUrl);
    // return /*await*/ open(apisUrl, { wait: false });
    /*await*/ open(apisUrl, { url: true });
    return;
    // return /*await*/ open(apisUrl, { url: true });
  }

  // The apis subcommands.
  const command: { [key: string]: Function } = {
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
      const projectId = await getProjectId(); // will prompt user to set up if required
      const MAX_PAGE_SIZE = 200; // This is the max page size according to the docs.
      const list: GaxiosResponse<
        serviceusage_v1.Schema$ListServicesResponse
      > = await serviceUsage.services.list({
        parent: `projects/${projectId}`,
        filter: 'state:ENABLED',
        pageSize: MAX_PAGE_SIZE,
      });
      const serviceList = list.data.services || [];
      if (serviceList.length >= MAX_PAGE_SIZE) {
        console.log('There is a bug with pagination. Please file an issue on Github.');
      }

      // Filter out the disabled ones. Print the enabled ones.
      const enabledAPIs = serviceList.filter(
        (service: serviceusage_v1.Schema$GoogleApiServiceusageV1Service) => {
          return service.state === 'ENABLED';
        },
      );
      for (const enabledAPI of enabledAPIs) {
        if (enabledAPI.config && enabledAPI.config.documentation) {
          const name = enabledAPI.config.name || 'Unknown name.';
          console.log(`${name.substr(0, name.indexOf('.'))} - ${enabledAPI.config.documentation.summary}`);
        }
      }

      /**
       * List available APIs.
       */
      console.log('\n# List of available APIs:');
      const { data } = await discovery.apis.list({
        preferred: true,
      });
      const services = data.items || [];
      // Only get the public service IDs
      const PUBLIC_ADVANCED_SERVICE_IDS = PUBLIC_ADVANCED_SERVICES.map(
        advancedService => advancedService.serviceId,
      );

      // Merge discovery data with public services data.
      const publicServices = [];
      for (const publicServiceId of PUBLIC_ADVANCED_SERVICE_IDS) {
        const service = services.find(s => s.name === publicServiceId);
        // for some reason 'youtubePartner' is not in the api list.
        if (service && service.id && service.description) {
          publicServices.push(service);
        }
      }

      // Sort the services based on id
      // tslint:disable-next-line:no-any
      publicServices.sort((a: any, b: any) => {
        if (a.id < b.id) return -1;
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
    await command[subcommand]();
  } else {
    logError(null, ERROR.COMMAND_DNE('apis ' + subcommand));
  }
};
