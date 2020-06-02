import { loadAPICredentials, script } from '../auth';
import { checkIfOnline, getProjectSettings, LOG, logError, spinner, ERROR } from '../utils';
import { script_v1 } from 'googleapis';

/**
 * Displays metrics for the current script
 * @param cmd.json {boolean} Displays the status in json format.
 */
export default async (): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.METRICS(scriptId)).start();
  const metrics = await script.projects.getMetrics({
    scriptId,
    metricsGranularity: 'DAILY',
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (metrics.status !== 200) logError(metrics.statusText);
  const { data } = metrics;

  type Maybe<T> = T | undefined | null;
  // Function to format a time range into a user friendly format.
  // API appears to always returns whole UTC days. Bail out if this assumption doesn't hold.
  const formatTime = ({startTime, endTime}: {startTime: Maybe<string>, endTime: Maybe<string>}) =>
    (startTime?.endsWith('T00:00:00Z') && endTime?.endsWith('T00:00:00Z')) ?
      startTime.slice(0, 10) :
      logError(ERROR.METRICS_UNEXPECTED_RANGE);

  // Function to create a Map from an array of MetricsValues (time range -> value)
  const array2map = (metricsValues: script_v1.Schema$MetricsValue[]) =>
    new Map(metricsValues.map(({startTime, endTime, value}) => ([
      formatTime({ startTime , endTime }),
      value || '0',
    ])),
  );

  // Turn raw data array into range (string) -> value (string) Maps
  const activeUsers = array2map(data.activeUsers || []);
  const failedExecutions = array2map(data.failedExecutions || []);
  const totalExecutions = array2map(data.totalExecutions || []);

  // Create a sorted array of unique time ranges
  const timeRanges = Array.from(new Set([
    ...activeUsers.keys(),
    ...failedExecutions.keys(),
    ...totalExecutions.keys(),
  ])).sort().reverse();

  // Turn the dataset into a table
  const table = timeRanges.map(timeRange => {
    const get = (map: Map<string, string>) => (map.get(timeRange) || '0');
    return [
      timeRange,
      ' ' + get(activeUsers),
      get(activeUsers) === '1' ? 'user' : 'users',
      ' ' + get(totalExecutions),
      get(totalExecutions) === '1' ? 'execution' : 'executions',
      ' ' + get(failedExecutions),
      'failed',
    ];
  });

  const padders = [
    String.prototype.padEnd, // for time range
    String.prototype.padStart, // for number of user(s)
    String.prototype.padEnd, // for 'user' / 'users'
    String.prototype.padStart, // for number of executions
    String.prototype.padEnd, // for 'execution' / 'executions'
    String.prototype.padStart, // for number of failed executions
    String.prototype.padEnd, // for 'failed'
  ];

  // Determine padding for each column
  const paddings = padders.map(
    (_, columnIndex) => Math.max(...table.map(row => row[columnIndex].length)),
  );

  // Metrics API only supports UTC, and users might expect local time, let them know it's UTC.
  console.error('UTC Date');

  // Print results
  for (const row of table) {
    console.log(row.map((v, i) => padders[i].apply(v, [paddings[i]])).join(' '));
  }
};
