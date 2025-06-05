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
 * @fileoverview Provides functionality to retrieve Apps Script project logs
 * from Google Cloud Logging. It requires the project to be associated with
 * a Google Cloud Platform (GCP) project.
 */

import Debug from 'debug';
import {google} from 'googleapis';

import {fetchWithPages} from './utils.js';
import {ClaspOptions, assertAuthenticated, assertGcpProjectConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

/**
 * Manages the retrieval of log entries for an Apps Script project
 * from Google Cloud Logging.
 */
export class Logs {
  private options: ClaspOptions;

  /**
   * Constructs a Logs manager instance.
   * @param options The Clasp configuration options, expected to include credentials and GCP project ID.
   */
  constructor(options: ClaspOptions) {
    this.options = options;
  }

  /**
   * Fetches log entries for the configured GCP project.
   * Can optionally filter logs to retrieve only those created since a specific date.
   * @param since Optional Date object. If provided, only logs newer than this date will be fetched.
   * @returns A promise that resolves with an object containing the log entries (`results`)
   *          and a boolean indicating if there were `partialResults` (more pages available).
   *          Throws an error if authentication or configuration is missing, or if the API call fails.
   */
  async getLogEntries(since?: Date): Promise<{results: logging_v2.Schema$LogEntry[]; partialResults: boolean}> {
    debug('Fetching Cloud Logs for project. Since: %s', since?.toISOString() ?? 'N/A');
    assertAuthenticated(this.options); // Ensure user is authenticated.
    assertGcpProjectConfigured(this.options); // Ensure GCP project ID is available.

    const {credentials, project} = this.options;
    const logger = google.logging({version: 'v2', auth: credentials});

    // Construct the filter for fetching logs.
    // If 'since' is provided, filter by timestamp. Otherwise, fetch all (recent) logs.
    // See: https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
    const filter = since ? `timestamp >= "${since.toISOString()}"` : '';

    try {
      // Use fetchWithPages utility to handle pagination of log entries.
      const logResults = await fetchWithPages(async (pageSize, pageToken) => {
        const response = await logger.entries.list({
          requestBody: {
            resourceNames: [`projects/${project.projectId!}`], // projectId is asserted by assertGcpProjectConfigured.
            filter,
            orderBy: 'timestamp desc', // Get newest logs first (though they are reversed later for display).
            pageSize,
            pageToken,
          },
        });
        return {
          results: response.data.entries ?? [], // Ensure results is always an array.
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      });
      debug(`Fetched ${logResults.results.length} log entries.`);
      return logResults;
    } catch (error) {
      // Handle API errors using the standardized handler.
      return handleApiError(error);
    }
  }
}
