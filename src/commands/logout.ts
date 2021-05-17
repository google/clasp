import {Conf} from '../conf.js';
import {DOTFILE} from '../dotfile.js';
import {hasOauthClientSettings} from '../utils.js';

const {auth} = Conf.get();

/**
 * Logs out the user by deleting credentials.
 */
export default async (): Promise<void> => {
  let previousPath: string | undefined;

  if (hasOauthClientSettings(true)) {
    if (auth.isDefault()) {
      // If no local auth defined, try current directory
      previousPath = auth.path;
      auth.path = '.';
    }

    await DOTFILE.AUTH().delete();

    if (previousPath) {
      auth.path = previousPath;
    }
  }

  if (hasOauthClientSettings()) {
    if (!auth.isDefault()) {
      // If local auth defined, try with default (global)
      previousPath = auth.path;
      auth.path = '';
    }

    await DOTFILE.AUTH().delete();

    if (previousPath) {
      auth.path = previousPath;
    }
  }
};
