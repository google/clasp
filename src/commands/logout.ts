import { DOTFILE } from '../dotfile';
// import { hasOauthClientSettings } from '../utils';

/**
 * Logs out the user by deleting credentials.
 * ? @grant should logout allow 'local only' logout?
 */
export default async () => {
  DOTFILE.AUTH().delete();

  // if (hasOauthClientSettings(true)) DOTFILE.RC_LOCAL().delete();

  // // del doesn't work with a relative path (~)
  // if (hasOauthClientSettings()) DOTFILE.RC.delete();
};
