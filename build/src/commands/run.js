import chalk from 'chalk';
import readline from 'readline';
import { getFunctionNames } from '../apiutils.js';
import { getLocalScript, loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { addScopeToManifest, isValidRunManifest } from '../manifest.js';
import { ERROR } from '../messages.js';
import { URL } from '../urls.js';
import { getProjectSettings, parseJsonOrDie, spinner, stopSpinner } from '../utils.js';
/**
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param options.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @param options.params {string} JSON string of parameters to be input to function.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export default async (functionName, options) => {
    await loadAPICredentials();
    const { scriptId } = await getProjectSettings();
    const devMode = !options.nondev; // Defaults to true
    const { params: jsonString = '[]' } = options;
    const parameters = parseJsonOrDie(jsonString);
    await isValidRunManifest();
    // TODO COMMENT THIS. This uses a method that gives a HTML 404.
    // await enableExecutionAPI();
    // Pushes the latest code if in dev mode.
    // We need to update the manifest before executing to:
    // - Ensure the execution API is enabled.
    // - Ensure we can run functions that were developed locally but not pushed.
    if (devMode) {
        console.log('Running in dev mode.');
        // TODO enable this once we can properly await pushFiles
        // await pushFiles(true);
    }
    await runFunction(functionName !== null && functionName !== void 0 ? functionName : (await getFunctionNames(script, scriptId)), parameters, scriptId, devMode);
};
/**
 * Runs a function.
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
 */
const runFunction = async (functionName, parameters, scriptId, devMode) => {
    var _a;
    try {
        // Load local credentials.
        await loadAPICredentials(true);
        const localScript = await getLocalScript();
        spinner.start(`Running function: ${functionName}`);
        const apiResponse = await localScript.scripts.run({
            scriptId,
            requestBody: { function: functionName, parameters, devMode },
        });
        stopSpinner();
        if (!(apiResponse === null || apiResponse === void 0 ? void 0 : apiResponse.data.done)) {
            throw new ClaspError(ERROR.RUN_NODATA, 0); // Exit gracefully in case localhost server spun up for authorize
        }
        const { error, response } = apiResponse.data;
        // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
        if (response) {
            console.log((_a = response.result) !== null && _a !== void 0 ? _a : chalk.red('No response.'));
        }
        else if (error === null || error === void 0 ? void 0 : error.details) {
            // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#Status
            const { errorMessage, errorType, scriptStackTraceElements } = error.details[0];
            console.error(`${chalk.red('Exception:')}`, errorMessage, scriptStackTraceElements || []);
            throw new ClaspError(errorType);
        }
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        stopSpinner();
        if (error) {
            // TODO move these to logError when stable?
            switch (error.code) {
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
                    throw new ClaspError(`(${error.code}) Error: ${error.message}`);
            }
        }
    }
};
const readScopesFromStdinAndAddToManifest = () => {
    // Example scopes:
    // https://mail.google.com/
    // https://www.googleapis.com/auth/presentations
    // https://www.googleapis.com/auth/spreadsheets
    const scopes = [];
    const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '' });
    const readScope = (input) => {
        if (input === '') {
            readlineInterface.close();
        }
        else {
            scopes.push(input);
        }
    };
    const addToManifest = async () => {
        await addScopeToManifest(scopes);
        const scopeCount = scopes.length;
        console.log(`Added ${scopeCount} ${scopeCount === 1 ? 'scope' : 'scopes'} to your appsscript.json' oauthScopes`);
        console.log('Please `clasp login --creds <file>` to log in with these new scopes.');
    };
    readlineInterface.prompt();
    readlineInterface.on('line', readScope);
    readlineInterface.on('close', addToManifest);
};
//# sourceMappingURL=run.js.map