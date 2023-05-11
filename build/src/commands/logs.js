import is from '@sindresorhus/is';
import chalk from 'chalk';
import open from 'open';
import { loadAPICredentials, logger } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { DOTFILE } from '../dotfile.js';
import { projectIdPrompt } from '../inquirer.js';
import { ERROR, LOG } from '../messages.js';
import { URL } from '../urls.js';
import { getErrorMessage, getProjectSettings, isValidProjectId, spinner, stopSpinner } from '../utils.js';
/**
 * Prints StackDriver logs from this Apps Script project.
 * @param options.json {boolean} If true, the command will output logs as json.
 * @param options.open {boolean} If true, the command will open the StackDriver logs website.
 * @param options.setup {boolean} If true, the command will help you setup logs.
 * @param options.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 * @param options.simplified {boolean} If true, the command will remove timestamps from the logs.
 */
export default async (options) => {
    // Get project settings.
    const projectSettings = await getProjectSettings();
    let projectId = options.setup ? await setupLogs(projectSettings) : projectSettings.projectId;
    if (!projectId) {
        console.log(LOG.NO_GCLOUD_PROJECT);
        projectId = await setupLogs(projectSettings);
        console.log(LOG.LOGS_SETUP);
    }
    // If we're opening the logs, get the URL, open, then quit.
    if (options.open) {
        const url = URL.LOGS(projectId);
        console.log(`Opening logs: ${url}`);
        await open(url, { wait: false });
        return;
    }
    const { json, simplified } = options;
    // Otherwise, if not opening StackDriver, load StackDriver logs.
    if (options.watch) {
        const POLL_INTERVAL = 6000; // 6s
        setInterval(async () => {
            const startDate = new Date();
            startDate.setSeconds(startDate.getSeconds() - (10 * POLL_INTERVAL) / 1000);
            await fetchAndPrintLogs(json, simplified, projectId, startDate);
        }, POLL_INTERVAL);
    }
    else {
        await fetchAndPrintLogs(json, simplified, projectId);
    }
};
/**
 * This object holds all log IDs that have been printed to the user.
 * This prevents log entries from being printed multiple times.
 * StackDriver isn't super reliable, so it's easier to get generous chunk of logs and filter them
 * rather than filter server-side.
 * @see logs.data.entries[0].insertId
 */
const logEntryCache = {};
const severityColor = {
    ERROR: chalk.red,
    INFO: chalk.cyan,
    DEBUG: chalk.green,
    NOTICE: chalk.magenta,
    WARNING: chalk.yellow,
};
/**
 * Prints log entries
 * @param entries {any[]} StackDriver log entries.
 */
const printLogs = (input = [], formatJson = false, simplified = false) => {
    const entries = [...input].reverse().slice(0, 50); // Print in syslog ascending order
    for (const entry of entries) {
        const { severity = '', timestamp = '', resource, insertId = '' } = entry;
        if (resource === null || resource === void 0 ? void 0 : resource.labels) {
            let { function_name: functionName = ERROR.NO_FUNCTION_NAME } = resource.labels;
            functionName = functionName.padEnd(15);
            let payloadData = '';
            if (formatJson) {
                payloadData = JSON.stringify(entry, null, 2);
            }
            else {
                const kludge = obscure(entry, functionName);
                payloadData = kludge.payloadData;
                functionName = kludge.functionName;
            }
            const coloredSeverity = `${severityColor[severity](severity) || severity}`.padEnd(20);
            // If we haven't logged this entry before, log it and mark the cache.
            if (!logEntryCache[insertId]) {
                console.log(simplified
                    ? `${coloredSeverity} ${functionName} ${payloadData}`
                    : `${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
                logEntryCache[insertId] = true;
            }
        }
    }
};
const obscure = (entry, functionName) => {
    var _a;
    const { jsonPayload, protoPayload = {}, textPayload } = entry;
    // Chokes on unmatched json payloads
    // jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
    let payloadData = (_a = textPayload !== null && textPayload !== void 0 ? textPayload : ((jsonPayload ? JSON.stringify(jsonPayload).slice(0, 255) : '') || protoPayload)) !== null && _a !== void 0 ? _a : ERROR.PAYLOAD_UNKNOWN;
    if (!is.string(payloadData) && protoPayload['@type'] === 'type.googleapis.com/google.cloud.audit.AuditLog') {
        payloadData = LOG.STACKDRIVER_SETUP;
        functionName = protoPayload.methodName.padEnd(15);
    }
    if (is.string(payloadData)) {
        payloadData = payloadData.padEnd(20);
    }
    return { functionName, payloadData };
};
const setupLogs = async (projectSettings) => {
    try {
        console.log(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(projectSettings.scriptId))}\n`);
        console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
        const dotfile = DOTFILE.PROJECT();
        if (!dotfile) {
            throw new ClaspError(ERROR.SETTINGS_DNE());
        }
        const settings = await dotfile.read();
        if (!settings.scriptId) {
            throw new ClaspError(ERROR.SCRIPT_ID_DNE());
        }
        const { projectId } = await projectIdPrompt();
        await dotfile.write({ ...settings, projectId });
        return projectId;
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(getErrorMessage(error)); // TODO get rid of type casting
    }
};
/**
 * Fetches the logs and prints the to the user.
 * @param startDate {Date?} Get logs from this date to now.
 */
const fetchAndPrintLogs = async (formatJson = false, simplified = false, projectId, startDate) => {
    // Validate projectId
    if (!projectId) {
        throw new ClaspError(ERROR.NO_GCLOUD_PROJECT());
    }
    if (!isValidProjectId(projectId)) {
        throw new ClaspError(ERROR.PROJECT_ID_INCORRECT(projectId));
    }
    const { isLocalCreds } = await loadAPICredentials();
    spinner.start(`${isLocalCreds ? LOG.LOCAL_CREDS() : ''}${LOG.GRAB_LOGS}`);
    // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
    // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
    const filter = startDate ? `timestamp >= "${startDate.toISOString()}"` : '';
    try {
        const logs = await logger.entries.list({
            requestBody: { resourceNames: [`projects/${projectId}`], filter, orderBy: 'timestamp desc' },
        });
        // We have an API response. Now, check the API response status.
        stopSpinner();
        // Only print filter if provided.
        if (filter.length > 0) {
            console.log(filter);
        }
        // Parse response and print logs or print error message.
        const { data, status, statusText } = logs;
        switch (status) {
            case 200:
                printLogs(data.entries, formatJson, simplified);
                break;
            case 401:
                throw new ClaspError(isLocalCreds ? ERROR.UNAUTHENTICATED_LOCAL : ERROR.UNAUTHENTICATED);
            case 403:
                throw new ClaspError(isLocalCreds ? ERROR.PERMISSION_DENIED_LOCAL : ERROR.PERMISSION_DENIED);
            default:
                throw new ClaspError(`(${status}) Error: ${statusText}`);
        }
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(ERROR.PROJECT_ID_INCORRECT(projectId));
    }
};
//# sourceMappingURL=logs.js.map