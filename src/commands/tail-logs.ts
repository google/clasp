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
 * @fileoverview Implements the `clasp logs` or `clasp tail-logs` command.
 * This command fetches and displays log entries from Google Cloud Logging for
 * the current Apps Script project. It supports JSON output, simplified formatting,
 * and a watch mode to continuously poll for new logs.
 */

import chalk, {ChalkInstance} from 'chalk';
import {Command} from 'commander';
import {logging_v2 as loggingV2} from 'googleapis';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, isInteractive, maybePromptForProjectId, withSpinner} from './utils.js';

/**
 * Interface for the command options specific to the `tail-logs` command.
 */
interface CommandOption {
  /** If true, output logs in JSON format. */
  readonly json?: boolean;
  /** If true, continuously watch for and print new log entries. */
  readonly watch?: boolean;
  /** If true, hide timestamps in the log output for a simpler view. */
  readonly simplified?: boolean;
}

/**
 * Command to fetch and display log entries from Google Cloud Logging for the Apps Script project.
 * Supports JSON output, simplified formatting, and a watch mode.
 */
export const command = new Command('tail-logs')
  .alias('logs') // Short alias for convenience.
  .description('Fetch and display the most recent log entries from Cloud Logging.')
  .option('--json', 'Output logs in raw JSON format.', false)
  .option('--watch', 'Continuously watch for and print new log entries.', false)
  .option('--simplified', 'Hide timestamps in log output for a cleaner view.', false)
  /**
   * Action handler for the `tail-logs` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    const {json, simplified, watch} = options;

    // Keep track of seen entry IDs to prevent duplicate printing, especially in watch mode.
    const seenEntries = new Set<string>();
    // Timestamp of the last fetched log entry, used for polling in watch mode.
    let since: Date | undefined;

    /**
     * Fetches new log entries since the last fetch (or all recent if first time)
     * and prints them to the console, respecting formatting options.
     */
    const fetchAndPrintLogs = async () => {
      const fetchingMsg = intl.formatMessage({defaultMessage: 'Fetching logs...'});
      const logEntriesResponse = await withSpinner(fetchingMsg, async () => clasp.logs.getLogEntries(since));

      // Logs are typically returned newest first, so reverse for chronological display.
      logEntriesResponse.results.reverse().forEach(entry => {
        if (entry.timestamp) {
          // Update 'since' to the timestamp of the latest processed entry for the next poll.
          // Add a millisecond to avoid fetching the same log entry again.
          since = new Date(new Date(entry.timestamp).getTime() + 1);
        }
        const entryId = entry.insertId;
        if (!entryId || seenEntries.has(entryId)) {
          return; // Skip if no ID or already seen.
        }
        seenEntries.add(entryId);

        const formattedMessage = formatEntry(entry, {json, simplified});
        if (formattedMessage) {
          console.log(formattedMessage);
        }
      });
    };

    // Ensure a GCP project ID is configured.
    if (!clasp.project.projectId && isInteractive()) {
      await maybePromptForProjectId(clasp);
    }
    assertGcpProjectConfigured(clasp); // Halts if no GCP project is configured.

    console.log(intl.formatMessage(
      {defaultMessage: 'Fetching logs for project: {projectId}'},
      {projectId: clasp.project.projectId}
    ));
    await fetchAndPrintLogs(); // Initial fetch and print.

    if (watch) {
      // In watch mode, poll for new logs at a defined interval.
      const POLL_INTERVAL_MS = 6000; // 6 seconds.
      console.log(intl.formatMessage(
        {defaultMessage: 'Watching for new logs... (Polling every {interval}s)'},
        {interval: POLL_INTERVAL_MS / 1000}
      ));
      setInterval(async () => {
        await fetchAndPrintLogs();
      }, POLL_INTERVAL_MS);
      // Note: setInterval will keep the process alive. User needs to Ctrl+C to exit.
    }
  });

/**
 * Options for formatting a single log entry.
 */
type FormatOptions = {
  /** Output in raw JSON format. */
  json?: boolean;
  /** Hide timestamps for a simpler view. */
  simplified?: boolean;
};

/**
 * Chalk instances for colorizing log entries based on severity.
 */
const severityColor: Record<string, ChalkInstance> = {
  ERROR: chalk.red,
  INFO: chalk.cyan,
  DEBUG: chalk.green, // Includes Apps Script's `console.timeEnd()`
  NOTICE: chalk.magenta,
  WARNING: chalk.yellow,
  // DEFAULT or other severities will not be colored.
};

/**
 * Formats a single log entry for display.
 * @param entry The log entry object from Google Cloud Logging.
 * @param options Formatting options (JSON, simplified).
 * @returns A string representation of the log entry, or undefined if the entry is malformed.
 */
function formatEntry(entry: loggingV2.Schema$LogEntry, options: FormatOptions): string | undefined {
  const {severity = 'DEFAULT', timestamp, resource, jsonPayload, textPayload} = entry;

  // Basic validation for essential fields.
  if (!resource?.labels || !timestamp) {
    return undefined; // Skip malformed entries.
  }

  const functionName = resource.labels['function_name'] ?? 'N/A';
  let payloadString = '';

  if (options.json) {
    // Output the entire log entry as a formatted JSON string.
    return JSON.stringify(entry, null, 2);
  }

  // Determine the primary payload content.
  if (textPayload) {
    payloadString = textPayload;
  } else if (jsonPayload) {
    // If 'message' field exists in jsonPayload, use it, otherwise stringify the whole payload.
    payloadString = jsonPayload.fields?.message?.stringValue ?? JSON.stringify(jsonPayload);
  } else {
    return undefined; // Skip if no usable payload.
  }

  // Apply color to severity level.
  const colorizer = severityColor[severity] ?? chalk.white; // Default to white if no specific color.
  const coloredSeverity = colorizer(severity.padEnd(7)); // Pad for alignment.

  const formattedTimestamp = getLocalISODateTime(new Date(timestamp));

  if (options.simplified) {
    return `${coloredSeverity} [${functionName}] ${payloadString}`;
  }
  return `${coloredSeverity} ${formattedTimestamp} [${functionName}] ${payloadString}`;
}

/**
 * Formats a Date object into a local ISO-like string (YYYY-MM-DDTHH:mm:ss).
 * @param date The Date object to format.
 * @returns A string representation of the date and time.
 */
function getLocalISODateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
