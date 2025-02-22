import {Command} from 'commander';
import {AuthInfo} from '../auth/auth.js';

export const command = new Command('logout').description('Logout of clasp').action(async function (
  this: Command,
): Promise<void> {
  const auth: AuthInfo = this.opts().auth;

  if (!auth.credentialStore) {
    this.error('No credential store found, unable to log out.');
    return;
  }

  if (!auth.credentials) {
    return;
  }
  auth.credentialStore?.delete(auth.user);
});
