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
