import readline from 'readline';
import chalk from 'chalk';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-standalone';

import {GaxiosError} from 'gaxios';
import {OAuth2Client} from 'google-auth-library';
import {google} from 'googleapis';
import {getAuthorizedOAuth2ClientOrDie} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {addScopeToManifest, isValidRunManifest} from '../manifest.js';
import {ERROR} from '../messages.js';
import {URL} from '../urls.js';
import {getProjectIdOrDie} from '../utils.js';
import {checkIfOnlineOrDie, getProjectSettings, parseJsonOrDie, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly nondev: boolean;
  readonly params: string;
}
/**
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param options.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @param options.params {string} JSON string of parameters to be input to function.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export async function runFunctionCommand(functionName: string, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();

  const {scriptId} = await getProjectSettings();

  const devMode = !options.nondev; // Defaults to true
  const {params: jsonString = '[]'} = options;
  const parameters = parseJsonOrDie<string[]>(jsonString);

  await isValidRunManifest();

  const projectId = await getProjectIdOrDie();
  await enableAppsScriptAPI(oauth2Client, projectId);

  // Pushes the latest code if in dev mode.
  // We need to update the manifest before executing to:
  // - Ensure the execution API is enabled.
  // - Ensure we can run functions that were developed locally but not pushed.
  if (devMode) {
    console.log('Running in dev mode.');
    // TODO enable this once we can properly await pushFiles
    // await pushFiles(true);
  }

  if (!functionName) {
    const allFunctions = await getFunctionNames(oauth2Client, scriptId);
    const source = async (input = '') =>
      fuzzy.filter(input, allFunctions).map(element => ({
        value: element.original,
      }));

    functionName = await autocomplete({
      message: 'Select a functionName',
      source,
    });
  }

  await runFunction(oauth2Client, functionName, parameters, scriptId, devMode);
}

/**
 * Runs a function.
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
 */
async function runFunction(
  oauth2Client: OAuth2Client,
  functionName: string,
  parameters: string[],
  scriptId: string,
  devMode: boolean,
) {
  const script = google.script({version: 'v1', auth: oauth2Client});

  try {
    spinner.start(`Running function: ${functionName}`);

    const apiResponse = await script.scripts.run({
      scriptId,
      requestBody: {function: functionName, parameters, devMode},
    });

    stopSpinner();

    if (!apiResponse?.data.done) {
      throw new ClaspError(ERROR.RUN_NODATA, 0); // Exit gracefully in case localhost server spun up for authorize
    }

    const {error, response} = apiResponse.data;
    // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
    if (response) {
      console.log(response.result ?? chalk.red('No response.'));
    } else if (error?.details) {
      // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#Status
      const {errorMessage, errorType, scriptStackTraceElements} = error.details[0];
      console.error(`${chalk.red('Exception:')}`, errorMessage, scriptStackTraceElements || []);
      throw new ClaspError(errorType);
    }
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    if (error instanceof GaxiosError) {
      parseGaxiosError(error, scriptId);
    }
  } finally {
    stopSpinner();
  }
}

function parseGaxiosError(error: GaxiosError, scriptId: string) {
  // TODO move these to logError when stable?
  switch ((error as GaxiosError).status) {
    case 401:
      // The 401 is probably due to this error:
      // "Error: Local client credentials unauthenticated. Check scopes/authorization.""
      // This is probably due to the OAuth client not having authorized scopes.
      console.log(`Hey! It looks like you aren't authenticated for the scopes required by this script.
Please enter the scopes by doing the following:
1. Open Your Script: ${URL.SCRIPT(scriptId)}
2. File > Project Properties > Scopes
3. Copy/Paste the list of scopes here:
          ~ Example ~
https://mail.google.com/
https://www.googleapis.com/auth/presentations
----(When you're done, press <Enter> 2x)----`);

      readScopesFromStdinAndAddToManifest();

      // We probably don't need to show the unauth error
      // since we always prompt the user to fix this now.
      // throw new ClaspError(ERROR.UNAUTHENTICATED_LOCAL);
      break;
    case 403:
      throw new ClaspError(ERROR.PERMISSION_DENIED_LOCAL);
    case 404:
      throw new ClaspError(ERROR.EXECUTE_ENTITY_NOT_FOUND);
    default:
      throw new ClaspError(`(${(error as GaxiosError).status}) Error: ${(error as GaxiosError).message}`);
  }
}

async function readScopesFromStdinAndAddToManifest() {
  // Example scopes:
  // https://mail.google.com/
  // https://www.googleapis.com/auth/presentations
  // https://www.googleapis.com/auth/spreadsheets
  const scopes: string[] = [];

  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  const readScope: (input: string) => void = (input: string) => {
    if (input === '') {
      readlineInterface.close();
    } else {
      scopes.push(input);
    }
  };

  const addToManifest = async (): Promise<void> => {
    await addScopeToManifest(scopes);
    const scopeCount = scopes.length;
    console.log(`Added ${scopeCount} ${scopeCount === 1 ? 'scope' : 'scopes'} to your appsscript.json' oauthScopes`);
    console.log('Please `clasp login --creds <file>` to log in with these new scopes.');
  };

  readlineInterface.prompt();
  readlineInterface.on('line', readScope);
  readlineInterface.on('close', addToManifest);
}

/**
 * Prompts for the function name.
 */
async function getFunctionNames(oauth2Client: OAuth2Client, scriptId: string): Promise<Array<string>> {
  const script = google.script({version: 'v1', auth: oauth2Client});
  spinner.start('Getting functions');
  const content = await script.projects.getContent({scriptId});
  stopSpinner();
  if (content.status !== 200) {
    throw new ClaspError(content.statusText);
  }

  const {files = []} = content.data;
  return files
    .filter(file => file.functionSet?.values)
    .flatMap(file => file.functionSet!.values!)
    .map(func => func.name!);
}

/**
 * Enable 'script.googleapis.com' of Google API.
 */
async function enableAppsScriptAPI(oauth2Client: OAuth2Client, projectId: string) {
  const serviceUsage = google.serviceusage({version: 'v1', auth: oauth2Client});
  const name = `projects/${projectId}/services/script.googleapis.com`;
  await serviceUsage.services.enable({name});
}
