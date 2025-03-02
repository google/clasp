import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {assertGcpProjectConfigured, checkIfOnlineOrDie, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-credentials-setup')
  .description("Open credentials page for the script's GCP project")
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const url = `https://console.developers.google.com/apis/credentials?project=${projectId}`;
    await openUrl(url);
  });
