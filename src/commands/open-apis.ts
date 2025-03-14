import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {assertGcpProjectConfigured, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('open-api-console')
  .description('Open the API console for the current project.')
  .action(async function (this: Command) {
    const clasp: Clasp = this.opts().clasp;

    const projectId = await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const url = new URL('https://console.developers.google.com/apis/dashboard');
    url.searchParams.set('project', projectId ?? '');
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    await openUrl(url.toString());
  });
