import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-credentials-setup')
  .description("Open credentials page for the script's GCP project")
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    if (!projectId) {
      this.error('Project ID not set. Unable to open API console');
    }

    const url = `https://console.developers.google.com/apis/credentials?project=${projectId}`;
    console.log(`Opening credentials page: ${url}`);
    await openUrl(url);
  });
