/* eslint-disable new-cap,@typescript-eslint/default-param-last,@typescript-eslint/no-floating-promises,promise/prefer-await-to-then */
import chalk from 'chalk';
import {GaxiosResponse} from 'gaxios';
import {logging_v2 as loggingV2} from 'googleapis';
import open from 'open';

import {loadAPICredentials, logger} from '../auth';
import {DOTFILE, ProjectSettings} from '../dotfile';
import {projectIdPrompt} from '../inquirer';
import {ERROR, LOG} from '../messages';
import {URL} from '../urls';
import {checkIfOnline, getProjectSettings, isValidProjectId, logError, spinner} from '../utils';

/**
 * Prints StackDriver logs from this Apps Script project.
 * @param cmd.json {boolean} If true, the command will output logs as json.
 * @param cmd.open {boolean} If true, the command will open the StackDriver logs website.
 * @param cmd.setup {boolean} If true, the command will help you setup logs.
 * @param cmd.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 * @param cmd.simplified {boolean} If true, the command will remove timestamps from the logs.
 */
export default async (cmd: {
  readonly json: boolean;
  readonly open: boolean;
  readonly setup: boolean;
  readonly watch: boolean;
  readonly simplified: boolean;
}): Promise<void> => {
  await checkIfOnline();
  // Get project settings.
  let {projectId} = await getProjectSettings();
  projectId = cmd.setup ? await setupLogs() : projectId;
  if (!projectId) {
    console.log(LOG.NO_GCLOUD_PROJECT);
    projectId = await setupLogs();
    console.log(LOG.LOGS_SETUP);
  }

  // If we're opening the logs, get the URL, open, then quit.
  if (cmd.open) {
    const url = URL.LOGS(projectId);
    console.log(`Opening logs: ${url}`);
    await open(url, {wait: false});
    return;
  }

  // Otherwise, if not opening StackDriver, load StackDriver logs.
  if (cmd.watch) {
    const POLL_INTERVAL = 6000; // 6s
    setInterval(() => {
      const startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() - (10 * POLL_INTERVAL) / 1000);
      fetchAndPrintLogs(cmd.json, cmd.simplified, projectId, startDate);
    }, POLL_INTERVAL);
  } else {
    await fetchAndPrintLogs(cmd.json, cmd.simplified, projectId);
  }
};

/**
 * This object holds all log IDs that have been printed to the user.
 * This prevents log entries from being printed multiple times.
 * StackDriver isn't super reliable, so it's easier to get generous chunk of logs and filter them
 * rather than filter server-side.
 * @see logs.data.entries[0].insertId
 */
const logEntryCache: {[key: string]: boolean} = {};

/**
 * Prints log entries
 * @param entries {any[]} StackDriver log entries.
 */
function printLogs(entries: loggingV2.Schema$LogEntry[] = [], formatJson: boolean, simplified: boolean): void {
  entries.reverse(); // Print in syslog ascending order
  for (let i = 0; i < 50 && entries ? i < entries.length : i < 0; i += 1) {
    const {
      severity = '',
      timestamp = '',
      resource,
      textPayload = '',
      protoPayload = {},
      jsonPayload = null,
      insertId = '',
    } = entries[i];
    if (!resource || !resource.labels) return;
    let functionName = resource.labels.function_name;
    functionName = functionName ? functionName.padEnd(15) : ERROR.NO_FUNCTION_NAME;
    let payloadData: any = '';
    if (formatJson) {
      payloadData = JSON.stringify(entries[i], null, 2);
    } else {
      const data = {
        textPayload,
        // Chokes on unmatched json payloads
        // jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
        jsonPayload: jsonPayload ? JSON.stringify(jsonPayload).slice(0, 255) : '',
        protoPayload,
      };
      payloadData = data.textPayload ?? (data.jsonPayload || data.protoPayload) ?? ERROR.PAYLOAD_UNKNOWN;
      if (payloadData && payloadData['@type'] === 'type.googleapis.com/google.cloud.audit.AuditLog') {
        payloadData = LOG.STACKDRIVER_SETUP;
        functionName = (protoPayload!.methodName as string).padEnd(15);
      }

      if (payloadData && typeof payloadData === 'string') {
        payloadData = payloadData.padEnd(20);
      }
    }

    const coloredStringMap: {[key: string]: string} = {
      ERROR: chalk.red(severity),
      INFO: chalk.cyan(severity),
      DEBUG: chalk.green(severity), // Includes timeEnd
      NOTICE: chalk.magenta(severity),
      WARNING: chalk.yellow(severity),
    };
    let coloredSeverity: string = coloredStringMap[severity!] || severity!;
    coloredSeverity = String(coloredSeverity).padEnd(20);
    // If we haven't logged this entry before, log it and mark the cache.
    if (!logEntryCache[insertId!]) {
      if (simplified) {
        console.log(`${coloredSeverity} ${functionName} ${payloadData}`);
      } else {
        console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
      }

      logEntryCache[insertId!] = true;
    }
  }
}

async function setupLogs(): Promise<string> {
  let projectId: string;
  return new Promise<string>((resolve, reject) => {
    getProjectSettings().then((projectSettings: Readonly<ProjectSettings>) => {
      console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(projectSettings.scriptId))}\n`);
      console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
      projectIdPrompt()
        .then(answers => {
          projectId = answers.projectId;
          const dotfile = DOTFILE.PROJECT();
          if (!dotfile) logError(null, ERROR.SETTINGS_DNE);
          dotfile
            .read<ProjectSettings>()
            .then((settings: Readonly<ProjectSettings>) => {
              if (!settings.scriptId) logError(ERROR.SCRIPT_ID_DNE);
              dotfile.write({...settings, ...{projectId}});
              resolve(projectId);
            })
            .catch((error: object) => logError(error));
        })
        .catch((error: Readonly<Error>) => {
          console.log(error);
          reject();
        });
    });
  }).catch(error => {
    if (spinner.isSpinning()) spinner.stop(true);
    return logError(error); // Only because tsc doesn't understand logError never return type
  });
}

/**
 * Fetches the logs and prints the to the user.
 * @param startDate {Date?} Get logs from this date to now.
 */
async function fetchAndPrintLogs(
  formatJson: boolean,
  simplified: boolean,
  projectId?: string,
  startDate?: Date
): Promise<void> {
  const oauthSettings = await loadAPICredentials();
  spinner.setSpinnerTitle(`${oauthSettings.isLocalCreds ? LOG.LOCAL_CREDS : ''}${LOG.GRAB_LOGS}`).start();
  // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
  // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
  let filter = '';
  if (startDate) {
    filter = `timestamp >= "${startDate.toISOString()}"`;
  }

  // Validate projectId
  if (!projectId) {
    logError(null, ERROR.NO_GCLOUD_PROJECT);
    return; // Only because tsc doesn't understand logError never return type
  }

  if (!isValidProjectId(projectId)) {
    logError(null, ERROR.PROJECT_ID_INCORRECT(projectId));
  }

  try {
    const logs = await logger.entries.list({
      requestBody: {
        resourceNames: [`projects/${projectId}`],
        filter,
        orderBy: 'timestamp desc',
      },
    });
    // We have an API response. Now, check the API response status.
    if (spinner.isSpinning()) spinner.stop(true);
    // Only print filter if provided.
    if (filter.length > 0) {
      console.log(filter);
    }

    // Parse response and print logs or print error message.
    const parseResponse = (response: GaxiosResponse<loggingV2.Schema$ListLogEntriesResponse>) => {
      if (response.status === 200) {
        printLogs(response.data.entries, formatJson, simplified);
      } else {
        switch (response.status) {
          case 401:
            logError(null, oauthSettings.isLocalCreds ? ERROR.UNAUTHENTICATED_LOCAL : ERROR.UNAUTHENTICATED);
            break;
          case 403:
            logError(null, oauthSettings.isLocalCreds ? ERROR.PERMISSION_DENIED_LOCAL : ERROR.PERMISSION_DENIED);
            break;
          default:
            logError(null, `(${response.status}) Error: ${response.statusText}`);
        }
      }
    };

    parseResponse(logs);
  } catch {
    if (spinner.isSpinning()) spinner.stop(true);
    logError(null, ERROR.PROJECT_ID_INCORRECT(projectId));
  }
}
