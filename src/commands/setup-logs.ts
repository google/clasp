import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, isInteractive, maybePromptForProjectId} from './utils.js';

export const command = new Command('setup-logs').description('Setup Cloud Logging').action(async function (
  this: Command,
): Promise<void> {
  const clasp: Clasp = this.opts().clasp;

  if (!clasp.project.projectId && isInteractive()) {
    await maybePromptForProjectId(clasp);
  }

  assertGcpProjectConfigured(clasp);

  const successMessage = intl.formatMessage({
    defaultMessage: 'Script logs are now available in Cloud Logging.',
  });
  console.log(successMessage);
});
