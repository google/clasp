import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-logs')
  .description('Open logs in the developer console')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;
    clasp.project.exists();

    const projectId = await maybePromptForProjectId(clasp);

    const url = `https://console.cloud.google.com/logs/viewer?project=${projectId}&resource=app_script_function`;
    console.log(`Opening logs: ${url}`);
    await openUrl(url);
  });
