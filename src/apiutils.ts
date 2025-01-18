import {google} from 'googleapis';

import {getAuthorizedOAuth2Client} from './auth.js';
import {ClaspError} from './clasp-error.js';
import {enableOrDisableAdvanceServiceInManifest} from './manifest.js';
import {ERROR} from './messages.js';
import {getProjectId} from './utils.js';

export async function getAuthorizedOAuth2ClientOrDie() {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }
  return oauth2Client;
}

/**
 * Gets the project ID from the manifest. If there is no project ID, it returns an error.
 */
export async function getProjectIdOrDie(): Promise<string> {
  const projectId = await getProjectId(); // Will prompt user to set up if required
  if (projectId) {
    return projectId;
  }

  throw new ClaspError(ERROR.NO_GCLOUD_PROJECT());
}

// /**
//  * Returns true if the service is enabled for the Google Cloud Project.
//  * @param {string} serviceName The service name.
//  * @returns {boolean} True if the service is enabled.
//  */
// export async function isEnabled(serviceName: string): Promise<boolean> {
//   const serviceDetails = await serviceUsage.services.get({name: serviceName});
//   return serviceDetails.data.state === 'ENABLED';
// }

/**
 * Enables or disables a Google API.
 * @param {string} serviceName The name of the service. i.e. sheets
 * @param {boolean} enable Enables the API if true, otherwise disables.
 */
export async function enableOrDisableAPI(serviceName: string, enable: boolean): Promise<void> {
  if (!serviceName) {
    throw new ClaspError('An API name is required. Try sheets');
  }

  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }

  const serviceUsage = google.serviceusage({version: 'v1', auth: oauth2Client});

  const name = `projects/${await getProjectIdOrDie()}/services/${serviceName}.googleapis.com`;
  try {
    await (enable ? serviceUsage.services.enable({name}) : serviceUsage.services.disable({name}));
    await enableOrDisableAdvanceServiceInManifest(serviceName, enable);
    console.log(`${enable ? 'Enable' : 'Disable'}d ${serviceName} API.`);
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    // If given non-existent API (like fakeAPI, it throws 403 permission denied)
    // We will log this for the user instead:
    console.log(error);

    throw new ClaspError(ERROR.NO_API(enable, serviceName));
  }
}
