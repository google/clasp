import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-api-console')
  .description('Open the API console for the current project.')
  .action(async function (this: Command) {
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    if (!projectId) {
      this.error('Project ID not set.');
    }

    const apisUrl = `https://console.developers.google.com/apis/dashboard?project=${projectId}`;
    console.log(apisUrl);
    await openUrl(apisUrl);
  });
