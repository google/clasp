import { Conf } from '../conf';
import { DOTFILE } from '../dotfile';
import { hasOauthClientSettings } from '../utils';
// import { hasOauthClientSettings } from '../utils';

/**
 * Logs out the user by deleting credentials.
 */
export default async () => {
  if (hasOauthClientSettings(true)) {
    const auth = Conf.get().auth;
    const uglyStateMgmt = auth.path;
    if (auth.isDefault()) {
      auth.path = '.';
    }
    DOTFILE.AUTH().delete();
    auth.path = uglyStateMgmt;
  }

  // del doesn't work with a relative path (~)
  if (hasOauthClientSettings()) DOTFILE.AUTH().delete();
};
