import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-logs')
  .description('Open logs in the developer console')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const url = new URL('https://console.cloud.google.com/logs/viewer');
    url.searchParams.set('project', projectId ?? '');
    url.searchParams.set('resource', 'app_script_function');
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    await openUrl(url.toString());
  });
