import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';

export const command = new Command('list-versions')
  .alias('versions')
  .description('List versions of a script')
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const versions = await withSpinner('Fetching versions...', async () => {
      return await clasp.project.listVersions();
    });

    if (versions.results.length === 0) {
      throw new Error(LOG.DEPLOYMENT_DNE);
    }

    console.log(LOG.VERSION_NUM(versions.results.length));
    versions.results.reverse();
    versions.results.forEach(version => console.log(LOG.VERSION_DESCRIPTION(version)));
  });
