import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

export const command = new Command('list-deployments')
  .alias('deployments')
  .description('List deployment ids of a script')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching deployments...',
    });
    const deployments = await withSpinner(spinnerMsg, async () => {
      return await clasp.project.listDeployments();
    });

    if (!deployments.results.length) {
      const msg = intl.formatMessage({
        defaultMessage: 'No deployments.',
      });
      console.log(msg);
      return;
    }
    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# deployment} other {# deployments}}.',
      },
      {
        count: deployments.results.length,
      },
    );
    console.log(successMessage);
    deployments.results
      .filter(d => d.deploymentConfig && d.deploymentId)
      .forEach(d => {
        const versionString = d.deploymentConfig?.versionNumber ? `@${d.deploymentConfig.versionNumber}` : '@HEAD';
        const description = d.deploymentConfig?.description ? `- ${d.deploymentConfig.description}` : '';
        console.log(`- ${d.deploymentId} ${versionString} ${description}`);
      });
  });
