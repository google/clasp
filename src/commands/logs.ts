import chalk from 'chalk';
import {
  loadAPICredentials,
  logger,
} from './../auth';
import { DOTFILE, ProjectSettings } from './../dotfile';
import { URL } from './../urls';
import {
  ERROR,
  LOG,
  checkIfOnline,
  getProjectSettings,
  logError,
  spinner,
  isValidProjectId,
} from './../utils';
import { AxiosResponse } from 'axios';

const open = require('opn');
const inquirer = require('inquirer');
const padEnd = require('string.prototype.padend');

// setup inquirer
const prompt = inquirer.prompt;
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Prints StackDriver logs from this Apps Script project.
 * @param cmd.json {boolean} If true, the command will output logs as json.
 * @param cmd.open {boolean} If true, the command will open the StackDriver logs website.
 * @param cmd.setup {boolean} If true, the command will help you setup logs.
 * @param cmd.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 */
export default async (cmd: { json: boolean; open: boolean; setup: boolean; watch: boolean }) => {
  await checkIfOnline();
  /**
   * This object holds all log IDs that have been printed to the user.
   * This prevents log entries from being printed multiple times.
   * StackDriver isn't super reliable, so it's easier to get generous chunk of logs and filter them
   * rather than filter server-side.
   * @see logs.data.entries[0].insertId
   */
  const logEntryCache: { [key: string]: boolean } = {};

  /**
   * Prints log entries
   * @param entries {any[]} StackDriver log entries.
   */
  function printLogs(entries: any[] = []) {
    entries = entries.reverse(); // print in syslog ascending order
    for (let i = 0; i < 50 && entries ? i < entries.length : i < 0; ++i) {
      const { severity, timestamp, resource, textPayload, protoPayload, jsonPayload, insertId } = entries[i];
      let functionName = resource.labels.function_name;
      functionName = functionName ? padEnd(functionName, 15) : ERROR.NO_FUNCTION_NAME;
      let payloadData: any = '';
      if (cmd.json) {
        payloadData = JSON.stringify(entries[i], null, 2);
      } else {
        const data: any = {
          textPayload,
          // chokes on unmatched json payloads
          // jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
          jsonPayload: jsonPayload ? JSON.stringify(jsonPayload).substr(0, 255) : '',
          protoPayload,
        };
        payloadData = data.textPayload || data.jsonPayload || data.protoPayload || ERROR.PAYLOAD_UNKNOWN;
        if (payloadData && payloadData['@type'] === 'type.googleapis.com/google.cloud.audit.AuditLog') {
          payloadData = LOG.STACKDRIVER_SETUP;
          functionName = padEnd(protoPayload.methodName, 15);
        }
        if (payloadData && typeof payloadData === 'string') {
          payloadData = padEnd(payloadData, 20);
        }
      }
      const coloredStringMap: any = {
        ERROR: chalk.red(severity),
        INFO: chalk.cyan(severity),
        DEBUG: chalk.green(severity), // includes timeEnd
        NOTICE: chalk.magenta(severity),
        WARNING: chalk.yellow(severity),
      };
      let coloredSeverity: string = coloredStringMap[severity] || severity;
      coloredSeverity = padEnd(String(coloredSeverity), 20);
      // If we haven't logged this entry before, log it and mark the cache.
      if (!logEntryCache[insertId]) {
        console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
        logEntryCache[insertId] = true;
      }
    }
  }
  async function setupLogs(projectId?: string): Promise<string> {
    const promise = new Promise<string>((resolve, reject) => {
      getProjectSettings().then(projectSettings => {
        console.log(`Open this link: ${LOG.SCRIPT_LINK(projectSettings.scriptId)}\n`);
        console.log(`Go to *Resource > Cloud Platform Project...* and copy your projectId
  (including "project-id-")\n`);
        prompt([
          {
            type: 'input',
            name: 'projectId',
            message: 'What is your GCP projectId?',
          },
        ])
          .then((answers: any) => {
            projectId = answers.projectId;
            const dotfile = DOTFILE.PROJECT();
            if (!dotfile) return reject(logError(null, ERROR.SETTINGS_DNE));
            dotfile
              .read()
              .then((settings: ProjectSettings) => {
                if (!settings.scriptId) logError(ERROR.SCRIPT_ID_DNE);
                dotfile.write(Object.assign(settings, { projectId }));
                resolve(projectId);
              })
              .catch((err: object) => {
                reject(logError(err));
              });
          })
          .catch((err: any) => {
            reject(console.log(err));
          });
      });
    });
    promise.catch(err => {
      logError(err);
      spinner.stop(true);
    });
    return promise;
  }
  // Get project settings.
  let { projectId } = await getProjectSettings();
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
    return open(url, { wait: false });
  }

  /**
   * Fetches the logs and prints the to the user.
   * @param startDate {Date?} Get logs from this date to now.
   */
  async function fetchAndPrintLogs(startDate?: Date) {
    spinner.setSpinnerTitle(`${oauthSettings.isLocalCreds ? LOG.LOCAL_CREDS : ''}${LOG.GRAB_LOGS}`).start();
    // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
    // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
    let filter = '';
    if (startDate) {
      filter = `timestamp >= "${startDate.toISOString()}"`;
    }
    // validate projectId
    if (!projectId) {
      return logError(null, ERROR.NO_GCLOUD_PROJECT);
    }
    if (!isValidProjectId(projectId)) {
      return logError(null, ERROR.PROJECT_ID_INCORRECT(projectId));
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
      spinner.stop(true);
      // Only print filter if provided.
      if (filter.length) {
        console.log(filter);
      }
      // Parse response and print logs or print error message.
      const parseResponse = (response: AxiosResponse) => {
        if (logs.status !== 200) {
          switch (logs.status) {
            case 401:
              logError(
                null,
                oauthSettings.isLocalCreds ? ERROR.UNAUTHENTICATED_LOCAL : ERROR.UNAUTHENTICATED,
              );
            case 403:
              logError(
                null,
                oauthSettings.isLocalCreds ? ERROR.PERMISSION_DENIED_LOCAL : ERROR.PERMISSION_DENIED,
              );
            default:
              logError(null, `(${logs.status}) Error: ${logs.statusText}`);
          }
        } else {
          printLogs(logs.data.entries);
        }
      };
      parseResponse(logs);
    } catch (error) {
      spinner.stop(true);
      logError(null, ERROR.PROJECT_ID_INCORRECT(projectId));
    }
  }

  // Otherwise, if not opening StackDriver, load StackDriver logs.
  const oauthSettings = await loadAPICredentials();
  if (cmd.watch) {
    const POLL_INTERVAL = 6000; // 6s
    setInterval(() => {
      const startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() - (10 * POLL_INTERVAL) / 1000);
      fetchAndPrintLogs(startDate);
    }, POLL_INTERVAL);
  } else {
    fetchAndPrintLogs();
  }
};