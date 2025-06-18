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

// This file defines the 'tail-logs' (alias 'logs') command for the clasp CLI.

import chalk, {ChalkInstance} from 'chalk';
import {Command} from 'commander';
import {logging_v2 as loggingV2} from 'googleapis';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, isInteractive, maybePromptForProjectId, withSpinner} from './utils.js';

interface CommandOption {
  readonly json?: boolean;
  readonly watch?: boolean;
  readonly simplified?: boolean;
}

export const command = new Command('tail-logs')
  .alias('logs')
  .description('Print the most recent log entries')
  .option('--json', 'Show logs in JSON form')
  .option('--watch', 'Watch and print new logs')
  .option('--simplified', 'Hide timestamps with logs')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const {json, simplified, watch} = options;
    const seenEntries = new Set<string>();

    let since: Date | undefined;

    const fetchAndPrintLogs = async () => {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Fetching logs...',
      });
      const entries = await withSpinner(spinnerMsg, async () => await clasp.logs.getLogEntries(since));
      entries.results.reverse().forEach(entry => {
        if (entry.timestamp) {
          since = new Date(entry.timestamp);
        }
        const id = entry.insertId;
        if (!id) {
          return;
        }
        if (seenEntries.has(id)) {
          return;
        }

        seenEntries.add(id);

        const msg = formatEntry(entry, {
          json,
          simplified,
        });
        if (msg) {
          console.log(msg);
        }
      });
    };

    if (!clasp.project.projectId && isInteractive()) {
      await maybePromptForProjectId(clasp);
    }

    assertGcpProjectConfigured(clasp);

    console.log('PAST', clasp.project.projectId);
    await fetchAndPrintLogs();

    if (watch) {
      const POLL_INTERVAL = 6000; // 6s
      setInterval(async () => {
        await fetchAndPrintLogs();
      }, POLL_INTERVAL);
    }
  });

type FormatOptions = {
  json?: boolean;
  simplified?: boolean;
};

const severityColor: Record<string, ChalkInstance> = {
  ERROR: chalk.red,
  INFO: chalk.cyan,
  DEBUG: chalk.green, // Includes timeEnd
  NOTICE: chalk.magenta,
  WARNING: chalk.yellow,
};

function formatEntry(entry: loggingV2.Schema$LogEntry, options: FormatOptions): string | undefined {
  const {severity = '', timestamp = '', resource} = entry;

  if (!resource) {
    return undefined;
  }

  if (!timestamp) {
    return undefined;
  }

  let functionName = resource.labels?.['function_name'] ?? 'N/A';
  let payloadData = '';

  if (options.json) {
    payloadData = JSON.stringify(entry, null, 2);
  } else {
    const {jsonPayload, textPayload} = entry;

    if (textPayload) {
      payloadData = textPayload;
    } else if (jsonPayload && jsonPayload.message) {
      payloadData = jsonPayload.message;
    } else if (jsonPayload) {
      payloadData = JSON.stringify(jsonPayload);
    } else {
      return undefined;
    }
  }

  const coloredSeverity = `${severityColor[severity!](severity) || severity!}`.padEnd(20);

  functionName = functionName.padEnd(15);
  payloadData = payloadData.padEnd(20);

  const localizedTime = getLocalISODateTime(new Date(timestamp));

  if (options.simplified) {
    return `${coloredSeverity} ${functionName} ${payloadData}`;
  }
  return `${coloredSeverity} ${localizedTime} ${functionName} ${payloadData}`;
}

function getLocalISODateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
