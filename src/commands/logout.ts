import {Command} from 'commander';
import {AuthInfo} from '../auth/auth.js';
import {intl} from '../intl.js';

export const command = new Command('logout').description('Logout of clasp').action(async function (
  this: Command,
): Promise<void> {
  const auth: AuthInfo = this.opts().auth;

  if (!auth.credentialStore) {
    const msg = intl.formatMessage({
      defaultMessage: 'No credential store found, unable to log out.',
    });
    this.error(msg);
  }

  if (!auth.credentials) {
    return;
  }

  auth.credentialStore?.delete(auth.user);
  const successMessage = intl.formatMessage({
    defaultMessage: 'Deleted credentials.',
  });
  console.log(successMessage);
});
