import {Command} from 'commander';
import {AuthInfo, getUserInfo} from '../auth/auth.js';
import {LOG} from '../messages.js';
import {safeIsOnline} from './utils.js';

export const command = new Command('show-authorized-user')
  .description('Show information about the current authorizations state.')
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth;

    if (!auth.credentials) {
      console.log(LOG.NOT_LOGGED_IN);
      return;
    }

    const isOnline = await safeIsOnline();
    if (!isOnline) {
      console.log(LOG.LOGGED_IN_UNKNOWN);
      return;
    }

    const user = await getUserInfo(auth.credentials);
    if (!user || !user.email) {
      console.log(LOG.LOGGED_IN_UNKNOWN);
      return;
    }

    console.log(LOG.LOGGED_IN_AS(user.email));
  });
