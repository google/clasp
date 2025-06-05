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

import Debug from 'debug';
import {google} from 'googleapis';

import {ClaspOptions, assertAuthenticated, assertScriptConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

export class Functions {
  private options: ClaspOptions;

  constructor(options: ClaspOptions) {
    this.options = options;
  }

  async getFunctionNames(): Promise<Array<string>> {
    debug('Fetching runnable functions');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const credentials = this.options.credentials;
    const scriptId = this.options.project.scriptId;

    const script = google.script({version: 'v1', auth: credentials});
    const res = await script.projects.getContent({scriptId});

    const files = res.data.files;
    const functions: string[] = [];
    if (!files) {
      return functions;
    }

    return files.flatMap(file => file.functionSet?.values ?? []).map(func => func.name!);
  }

  async runFunction(functionName: string, parameters: unknown[], devMode = true) {
    debug('Running script function %s', functionName);
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const credentials = this.options.credentials;
    const scriptId = this.options.project.scriptId;
    const script = google.script({version: 'v1', auth: credentials});

    try {
      const request = {
        scriptId,
        requestBody: {
          function: functionName,
          parameters: parameters ?? [],
          devMode,
        },
      };
      debug('Running function with request: %O', request);
      const res = await script.scripts.run(request);
      if (!res.data) {
        throw new Error('Function returned undefined');
      }
      return res.data;
    } catch (error) {
      handleApiError(error);
    }
  }
}
