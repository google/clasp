import {Command} from 'commander';

import {Context} from '../context.js';

/**
 * Logs out the user by deleting credentials.
 */
export async function logoutCommand(this: Command): Promise<void> {
  const context: Context = this.opts().context;

  context.credentialStore.delete(context.userKey);
}
