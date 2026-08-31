import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

export const command = new Command('show-metrics')
  .alias('metrics')
  .description('Show project metrics')
  .option('--json', 'Show output in JSON format')
  .action(async function (this: Command): Promise<void> {
    const options = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching project metrics...',
    });
    const metrics = await withSpinner(spinnerMsg, async () => {
      return clasp.project.getMetrics();
    });

    if (options.json) {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    if (!metrics) {
      const msg = intl.formatMessage({
        defaultMessage: 'No metrics found.',
      });
      console.log(msg);
      return;
    }

    const activeUsers = metrics.activeUsers ?? [];
    const failedExecutions = metrics.failedExecutions ?? [];
    const totalExecutions = metrics.totalExecutions ?? [];

    if (activeUsers.length === 0 && failedExecutions.length === 0 && totalExecutions.length === 0) {
       console.log('No metrics available for this period.');
       return;
    }

    const displayMetrics = (title: string, data: any[]) => {
        console.log(title);
        if (data.length === 0) {
            console.log('  No data');
            return;
        }
        data.forEach((item) => {
           console.log(`  ${item.startTime} - ${item.endTime}: ${item.value}`);
        });
    };

    displayMetrics('Active Users:', activeUsers);
    displayMetrics('Failed Executions:', failedExecutions);
    displayMetrics('Total Executions:', totalExecutions);
  });
