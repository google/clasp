// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Provides functionality to interact with Apps Script functions,
 * including listing available function names and executing functions remotely.
 */

import Debug from 'debug';
import {google} from 'googleapis';

import {ClaspOptions, assertAuthenticated, assertScriptConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

/**
 * Manages operations related to Apps Script functions, such as listing
 * and executing them.
 */
export class Functions {
  private options: ClaspOptions;

  /**
   * Constructs a Functions manager instance.
   * @param options The Clasp configuration options.
   */
  constructor(options: ClaspOptions) {
    this.options = options;
  }

  /**
   * Fetches the names of all top-level functions in the Apps Script project.
   * This is useful for providing a list of functions that can be run.
   * @returns A promise that resolves with an array of function names.
   */
  async getFunctionNames(): Promise<string[]> {
    debug('Fetching list of runnable functions from the project...');
    assertAuthenticated(this.options); // Ensure user is authenticated.
    assertScriptConfigured(this.options); // Ensure project (scriptId) is configured.

    const {credentials, project} = this.options;
    const script = google.script({version: 'v1', auth: credentials});

    try {
      const response = await script.projects.getContent({scriptId: project.scriptId!}); // scriptId is asserted.
      const projectFiles = response.data.files;
      if (!projectFiles) {
        debug('No files found in the project content response.');
        return [];
      }
      // Extract function names from the functionSet of each file.
      const functionNames = projectFiles.flatMap(file => file.functionSet?.values ?? []).map(func => func.name!);
      debug(`Found ${functionNames.length} function(s): ${functionNames.join(', ')}`);
      return functionNames;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Executes a specified Apps Script function remotely.
   * @param functionName The name of the function to execute.
   * @param parameters An array of parameters to pass to the function.
   * @param devMode If true, executes the function in development mode (latest code);
   *                otherwise, executes the currently deployed version (if any). Defaults to true.
   * @returns A promise that resolves with the response from the function execution,
   *          or throws an error if the execution fails. The structure of the response
   *          depends on what the Apps Script function returns.
   */
  async runFunction(functionName: string, parameters: unknown[], devMode = true): Promise<unknown> {
    debug(`Executing Apps Script function: ${functionName} with devMode: ${devMode}`);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, project} = this.options;
    const script = google.script({version: 'v1', auth: credentials});

    try {
      const requestPayload = {
        scriptId: project.scriptId!, // scriptId is asserted.
        requestBody: { // This is the ScriptExecutionRequest
          function: functionName,
          parameters: parameters ?? [], // Ensure parameters is an array, even if empty.
          devMode,
        },
      };
      debug('Executing function with request payload: %O', requestPayload);
      const response = await script.scripts.run(requestPayload);

      // The response.data is an Operation object.
      // If done is true, the result or error is directly in this Operation object.
      // If done is false, it implies a long-running operation (not typical for simple function calls via API).
      if (!response.data) {
        // This case should ideally be handled by GaxiosError, but as a safeguard:
        throw new Error('No data received from function execution.');
      }
      if (response.data.error) {
        // Handle cases where the function execution itself resulted in an error within Apps Script.
        // This is different from an API call error.
        debug('Function execution resulted in an error: %O', response.data.error);
        // Re-throw or process the error as needed. For now, re-throwing a simplified error.
        // The `handleApiError` might not be suitable here as this is not an API transport error.
        // Consider a more specific error type or structure if detailed Apps Script errors need to be propagated.
        const scriptError = response.data.error.details && response.data.error.details.length > 0 ?
          response.data.error.details[0].errorMessage : response.data.error.message;
        throw new Error(`Error during script function execution: ${scriptError || 'Unknown error'}`);
      }
      // Return the actual result of the Apps Script function.
      return response.data.response?.result;
    } catch (error) {
      // This catches API call errors (e.g., network issues, auth problems, invalid request to `scripts.run`)
      // and also any errors thrown from the try block above (like the re-thrown scriptError).
      return handleApiError(error);
    }
  }
}
