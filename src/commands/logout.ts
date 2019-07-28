import { DOT } from '../dotfile';
import fs from 'fs-extra';
import { hasOauthClientSettings } from '../utils';

/**
 * Logs out the user by deleting credentials.
 */
export default async () => {
  if (hasOauthClientSettings(true)) fs.unlinkSync(DOT.RC.ABSOLUTE_LOCAL_PATH);
  // del doesn't work with a relative path (~)
  if (hasOauthClientSettings()) fs.unlinkSync(DOT.RC.ABSOLUTE_PATH);
};
