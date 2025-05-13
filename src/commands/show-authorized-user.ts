import {Command} from 'commander';
import {AuthInfo, getUserInfo} from '../auth/auth.js';
import {intl} from '../intl.js';

export const command = new Command('show-authorized-user')
  .description('Show information about the current authorizations state.')
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth;

    if (!auth.credentials) {
      const msg = intl.formatMessage({
        defaultMessage: 'Not logged in.',
      });
      console.log(msg);
      return;
    }

    const user = await getUserInfo(auth.credentials);
    const msg = intl.formatMessage(
      {
        defaultMessage: `{email, select,
        undefined {You are logged in as an unknown user.}
        other {You are logged in as {email}.}}`,
      },
      {
        email: user?.email,
      },
    );
    console.log(msg);
  });
