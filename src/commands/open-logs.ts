import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-logs')
  .description('Open logs in the developer console')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const url = `https://console.cloud.google.com/logs/viewer?project=${projectId}&resource=app_script_function`;
    await openUrl(url);
  });
