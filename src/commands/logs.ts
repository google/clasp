import is from '@sindresorhus/is';
import chalk, {ChalkInstance} from 'chalk';
import {Command} from 'commander';
import {google, logging_v2 as loggingV2} from 'googleapis';
import open from 'open';

import {OAuth2Client} from 'google-auth-library';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {ClaspError} from '../clasp-error.js';
import {Context, Project, assertAuthenticated, assertScriptSettings} from '../context.js';
import {ERROR, LOG} from '../messages.js';
import {URL} from '../urls.js';
import {checkIfOnlineOrDie, getOrPromptForProjectId, isValidProjectId, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly json?: boolean;
  readonly open?: boolean;
  readonly setup?: boolean;
  readonly watch?: boolean;
  readonly simplified?: boolean;
}

/**
 * Prints StackDriver logs from this Apps Script project.
 * @param options.json {boolean} If true, the command will output logs as json.
 * @param options.open {boolean} If true, the command will open the StackDriver logs website.
 * @param options.setup {boolean} If true, the command will help you setup logs.
 * @param options.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 * @param options.simplified {boolean} If true, the command will remove timestamps from the logs.
 */
export async function printLogsCommand(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  let projectId = context.project.settings.projectId;

  if (options.setup) {
    projectId = await setupLogs(context.project);
  }

  if (!projectId) {
    console.log(LOG.NO_GCLOUD_PROJECT);
    projectId = await setupLogs(context.project);
    console.log(LOG.LOGS_SETUP);
  }

  context.project.settings.projectId = projectId;

  // If we're opening the logs, get the URL, open, then quit.
  if (options.open) {
    const url = URL.LOGS(projectId);
    console.log(`Opening logs: ${url}`);
    await open(url, {wait: false});
    return;
  }

  const {json, simplified} = options;
  // Otherwise, if not opening StackDriver, load StackDriver logs.
  if (options.watch) {
    const POLL_INTERVAL = 6000; // 6s
    setInterval(async () => {
      const startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() - (10 * POLL_INTERVAL) / 1000);
      await fetchAndPrintLogs(context, json, simplified, startDate);
    }, POLL_INTERVAL);
  } else {
    await fetchAndPrintLogs(context, json, simplified);
  }
}

/**
 * This object holds all log IDs that have been printed to the user.
 * This prevents log entries from being printed multiple times.
 * StackDriver isn't super reliable, so it's easier to get generous chunk of logs and filter them
 * rather than filter server-side.
 * @see logs.data.entries[0].insertId
 */
const logEntryCache: Record<string, boolean> = {};

const severityColor: Record<string, ChalkInstance> = {
  ERROR: chalk.red,
  INFO: chalk.cyan,
  DEBUG: chalk.green, // Includes timeEnd
  NOTICE: chalk.magenta,
  WARNING: chalk.yellow,
};

/**
 * Prints log entries
 * @param entries {any[]} StackDriver log entries.
 */
function printLogs(
  input: ReadonlyArray<Readonly<loggingV2.Schema$LogEntry>> = [],
  formatJson = false,
  simplified = false,
): void {
  Array.from(input)
    .reverse()
    .slice(0, 50) // Print in syslog ascending order
    .forEach(entry => {
      const {severity = '', timestamp = '', resource, insertId = ''} = entry;

      if (logEntryCache[insertId!]) {
        return null;
      }

      if (!resource?.labels) {
        return null;
      }

      let functionName = (resource.labels.function_name ?? 'N/A').padEnd(15);
      let payloadData = '';

      if (formatJson) {
        payloadData = JSON.stringify(entry, null, 2);
      } else {
        const kludge = obscure(entry, functionName);
        payloadData = kludge.payloadData.toString();
        functionName = kludge.functionName;
      }

      const coloredSeverity = `${severityColor[severity!](severity) || severity!}`.padEnd(20);

      // If we haven't logged this entry before, log it and mark the cache.

      console.log(
        simplified
          ? `${coloredSeverity} ${functionName} ${payloadData}`
          : `${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`,
      );

      logEntryCache[insertId!] = true;
    });
}

function obscure(entry: Readonly<loggingV2.Schema$LogEntry>, functionName: string) {
  const {jsonPayload, protoPayload = {}, textPayload} = entry;

  // Chokes on unmatched json payloads
  // jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
  let payloadData =
    textPayload ??
    ((jsonPayload ? JSON.stringify(jsonPayload).slice(0, 255) : '') || protoPayload) ??
    ERROR.PAYLOAD_UNKNOWN;

  if (!is.string(payloadData) && protoPayload!['@type'] === 'type.googleapis.com/google.cloud.audit.AuditLog') {
    payloadData = LOG.STACKDRIVER_SETUP;
    functionName = (protoPayload!.methodName as string).padEnd(15);
  }

  if (is.string(payloadData)) {
    payloadData = payloadData.padEnd(20);
  }

  return {functionName, payloadData};
}

async function setupLogs(project: Project): Promise<string> {
  console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(project.settings.scriptId))}\n`);
  console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);

  const projectId = await getOrPromptForProjectId(project);

  return projectId;
}

/**
 * Fetches the logs and prints the to the user.
 * @param startDate {Date?} Get logs from this date to now.
 */
async function fetchAndPrintLogs(
  context: Context,
  formatJson = false,
  simplified = false,
  startDate?: Date,
): Promise<void> {
  // Validate projectId
  assertScriptSettings(context);

  if (!context.project.settings.projectId) {
    throw new ClaspError(ERROR.NO_GCLOUD_PROJECT(context.project?.configFilePath));
  }

  if (!isValidProjectId(context.project.settings.projectId)) {
    throw new ClaspError(ERROR.PROJECT_ID_INCORRECT(context.project.settings.projectId));
  }

  const logger = google.logging({version: 'v2', auth: context.credentials});

  // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
  // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
  const filter = startDate ? `timestamp >= "${startDate.toISOString()}"` : '';

  const res = await logger.entries.list({
    requestBody: {resourceNames: [`projects/${context.project.settings.projectId}`], filter, orderBy: 'timestamp desc'},
  });

  stopSpinner();

  // Only print filter if provided.
  if (filter.length > 0) {
    console.log(filter);
  }

  printLogs(res.data.entries, formatJson, simplified);
}
