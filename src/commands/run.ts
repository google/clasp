import chalk from 'chalk';
import * as pluralize from 'pluralize';
import {
  getFunctionNames,
} from '../apiutils';
import {
  getLocalScript,
  loadAPICredentials,
  script,
} from '../auth';
import {
  addScopeToManifest,
  isValidManifest,
} from '../manifest';
import { URL } from '../urls';
import {
  ERROR,
  checkIfOnline,
  getProjectSettings,
  logError,
  spinner,
} from '../utils';
/**
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param cmd.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export default async (functionName: string, cmd: { nondev: boolean; params: string }) => {
  function IsValidJSONString(str: string) {
    try {
      JSON.parse(str);
    } catch (error) {
      throw new Error('Error: Input params not Valid JSON string. Please fix and try again');
    }
    return true;
  }

  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings(true);
  const devMode = !cmd.nondev; // defaults to true
  const { params: paramString = '[]' } = cmd;
  IsValidJSONString(paramString);
  const params = JSON.parse(paramString);
  // Ensures the manifest is correct for running a function.
  // The manifest must include:
  // "executionApi": {
  //   "access": "MYSELF"
  // }
  await isValidManifest();

  // TODO COMMENT THIS. This uses a method that gives a HTML 404.
  // await enableExecutionAPI();

  // Pushes the latest code if in dev mode.
  // We need to update the manifest before executing to:
  // - Ensure the execution API is enabled.
  // - Ensure we can run functions that were developed locally but not pushed.
  if (devMode) {
    // TODO enable this once we can properly await pushFiles
    // await pushFiles(true);
  }

  // Get the list of functions.
  if (!functionName) functionName = await getFunctionNames(script, scriptId);

  /**
   * Runs a function.
   * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
   */
  async function runFunction(functionName: string, params: any[]) {
    try {
      // Load local credentials.
      await loadAPICredentials(true);
      const localScript = await getLocalScript();
      spinner.setSpinnerTitle(`Running function: ${functionName}`).start();
      const res = await localScript.scripts.run({
        scriptId,
        requestBody: {
          function: functionName,
          parameters: params,
          devMode,
        },
      });
      spinner.stop(true);
      if (!res || !res.data.done) {
        logError(null, ERROR.RUN_NODATA);
        process.exit(0); // exit gracefully in case localhost server spun up for authorize
      }
      const data = res.data;
      // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
      if (data.response) {
        if (data.response.result) {
          console.log(data.response.result);
        } else {
          console.log(chalk.red('No response.'));
        }
      } else if (data.error && data.error.details) {
        // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#Status
        console.error(
          `${chalk.red('Exception:')}`,
          data.error.details[0].errorType,
          data.error.details[0].errorMessage,
          data.error.details[0].scriptStackTraceElements || [],
        );
      }
    } catch (err) {
      spinner.stop(true);
      if (err) {
        // TODO move these to logError when stable?
        switch (err.code) {
          case 401:
            // The 401 is probably due to this error:
            // "Error: Local client credentials unauthenticated. Check scopes/authorization.""
            // This is probably due to the OAuth client not having authorized scopes.
            console.log(`` +
              `Hey! It looks like you aren't authenticated for the scopes required by this script.
Please enter the scopes by doing the following:
1. Open Your Script: ${URL.SCRIPT(scriptId)}
2. File > Project Properties > Scopes
3. Copy/Paste the list of scopes here:
              ~ Example ~
https://mail.google.com/
https://www.googleapis.com/auth/presentations
----(When you're done, press <Enter> 2x)----`);
            // Example scopes:
            // https://mail.google.com/
            // https://www.googleapis.com/auth/presentations
            // https://www.googleapis.com/auth/spreadsheets
            const readline = require('readline');
            const scopes: string[] = [];
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
              prompt: '',
            });
            rl.prompt();
            rl.on('line', (cmd: string) => {
              if (cmd === '') {
                rl.close();
              } else {
                scopes.push(cmd);
              }
            });
            rl.on('close', async () => {
              await addScopeToManifest(scopes);
              const numScopes = scopes.length;
              console.log(`Added ${numScopes} ` +
                `${pluralize('scope', numScopes)} to your appsscript.json' oauthScopes`);
              console.log('Please `clasp login --creds <file>` to log in with these new scopes.');
            });
            // We probably don't need to show the unauth error
            // since we always prompt the user to fix this now.
            // logError(null, ERROR.UNAUTHENTICATED_LOCAL);
            break;
          case 403:
            logError(null, ERROR.PERMISSION_DENIED_LOCAL);
            break;
          case 404:
            logError(null, ERROR.EXECUTE_ENTITY_NOT_FOUND);
            break;
          default:
            logError(null, `(${err.code}) Error: ${err.message}`);
        }
      }
    }
  }
  await runFunction(functionName, params);
};
