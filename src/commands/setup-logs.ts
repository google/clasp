import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {isInteractive, maybePromptForProjectId, openUrl} from './utils.js';

export const command = new Command('setup-logs').description('Setup Cloud Logging').action(async function (
  this: Command,
): Promise<void> {
  const clasp: Clasp = this.opts().clasp;

  const scriptId = clasp.project.scriptId;
  if (!scriptId) {
    this.error('Missing script ID');
  }

  if (!clasp.project.projectId && isInteractive()) {
    const url = `https://script.google.com/d/${clasp.project.scriptId}/edit`;
    console.log(`${LOG.OPEN_LINK(url)}\n`);
    await openUrl(url);
    console.log(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
    await maybePromptForProjectId(clasp);
  }
});
