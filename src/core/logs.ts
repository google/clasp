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

import {fetchWithPages} from './utils.js';
import {ClaspOptions, assertAuthenticated, assertGcpProjectConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

export class Logs {
  private options: ClaspOptions;

  constructor(options: ClaspOptions) {
    this.options = options;
  }

  async getLogEntries(since?: Date) {
    debug('Fetching logs');
    assertAuthenticated(this.options);
    assertGcpProjectConfigured(this.options);
    const credentials = this.options.credentials;

    const projectId = this.options.project.projectId;
    const logger = google.logging({version: 'v2', auth: credentials});

    // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
    // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
    const filter = since ? `timestamp >= "${since.toISOString()}"` : '';

    try {
      return fetchWithPages(async (pageSize, pageToken) => {
        const res = await logger.entries.list({
          requestBody: {
            resourceNames: [`projects/${projectId}`],
            filter,
            orderBy: 'timestamp desc',
            pageSize,
            pageToken,
          },
        });
        return {
          results: res.data.entries || [],
          nextPageToken: res.data.nextPageToken,
        };
      });
    } catch (error) {
      handleApiError(error);
    }
  }
}
