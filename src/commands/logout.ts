import * as del from 'del';
import { DOT } from './../dotfile';
import { hasOauthClientSettings } from './../utils';

/**
 * Logs out the user by deleting credentials.
 */
export default async () => {
  if (hasOauthClientSettings(true)) del(DOT.RC.ABSOLUTE_LOCAL_PATH, { force: true });
  // del doesn't work with a relative path (~)
  if (hasOauthClientSettings()) del(DOT.RC.ABSOLUTE_PATH, { force: true });
};
