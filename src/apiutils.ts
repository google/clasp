import fuzzy from 'fuzzy';
import { script_v1 } from 'googleapis';

import { loadAPICredentials, serviceUsage } from './auth';
import { functionNamePrompt, functionNameSource } from './inquirer';
import { enableOrDisableAdvanceServiceInManifest } from './manifest';
import { ERROR, ExitAndLogError, getErrorDescription, getProjectId, spinner } from './utils';

/**
 * Prompts for the function name.
 */
export async function getFunctionNames(script: script_v1.Script, scriptId: string): Promise<string> {
  spinner.setSpinnerTitle('Getting functions').start();
  const content = await script.projects.getContent({
    scriptId,
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (content.status !== 200) {
    // logError(content.statusText);
    throw new ExitAndLogError(1, getErrorDescription(content.statusText));
  }

  const files = content.data.files ?? [];
  type TypeFunction = script_v1.Schema$GoogleAppsScriptTypeFunction;
  const functionNames: string[] = files
    .reduce((functions: TypeFunction[], file: script_v1.Schema$File) => {
      if (!file.functionSet || !file.functionSet.values) return functions;
      return functions.concat(file.functionSet.values);
    }, [])
    .map((func: TypeFunction) => func.name) as string[];

  const source: functionNameSource = async (unused: object, input = '') =>
    // Returns a Promise
    // https://www.npmjs.com/package/inquirer-autocomplete-prompt-ipt#options
    new Promise(resolve => {
      // Example: https://github.com/ruyadorno/inquirer-autocomplete-prompt/blob/master/example.js#L76
      const original = fuzzy
        .filter(input, functionNames)
        .map((el) => el.original);

      resolve(original);
    });

  const answers = await functionNamePrompt(source);
  return answers.functionName;
}

/**
 * Gets the project ID from the manifest. If there is no project ID, it returns an error.
 */
async function getProjectIdWithErrors(): Promise<string> {
  const projectId = await getProjectId(); // will prompt user to set up if required
  if (!projectId) {
    // logError(null, ERROR.NO_GCLOUD_PROJECT);
    throw new ExitAndLogError(1, ERROR.NO_GCLOUD_PROJECT);
  }

  return projectId;
}

/**
 * Returns true if the service is enabled for the Google Cloud Project.
 * @param {string} serviceName The service name.
 * @returns {boolean} True if the service is enabled.
 */
export async function isEnabled(serviceName: string): Promise<boolean> {
  const serviceDetails = await serviceUsage.services.get({ name: serviceName });
  return serviceDetails.data.state === 'ENABLED';
}

/**
 * Enables or disables a Google API.
 * @param {string} serviceName The name of the service. i.e. sheets
 * @param {boolean} enable Enables the API if true, otherwise disables.
 */
export async function enableOrDisableAPI(serviceName: string, enable: boolean): Promise<void> {
  if (!serviceName) {
    // logError(null, 'An API name is required. Try sheets');
    throw new ExitAndLogError(1, 'An API name is required. Try sheets');
  }

  const projectId = await getProjectIdWithErrors();
  const name = `projects/${projectId}/services/${serviceName}.googleapis.com`;
  try {
    if (enable) {
      await serviceUsage.services.enable({ name });
    } else {
      await serviceUsage.services.disable({ name });
    }

    await enableOrDisableAdvanceServiceInManifest(serviceName, enable);
    console.log(`${enable ? 'Enable' : 'Disable'}d ${serviceName} API.`);
  } catch (error) {
    // Rethrow `ExitAndLogError`s
    if (error instanceof ExitAndLogError) {
      throw error;
    }

    // If given non-existent API (like fakeAPI, it throws 403 permission denied)
    // We will log this for the user instead:
    console.log(error);
    // logError(null, ERROR.NO_API(enable, serviceName));
    throw new ExitAndLogError(1, ERROR.NO_API(enable, serviceName));
  }
}

/**
 * Enable 'script.googleapis.com' of Google API.
 */
export async function enableAppsScriptAPI(): Promise<void> {
  await loadAPICredentials();
  const projectId = await getProjectIdWithErrors();
  const name = `projects/${projectId}/services/script.googleapis.com`;
  await serviceUsage.services.enable({ name });
}
