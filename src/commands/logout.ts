import {Conf} from '../conf.js';
import fs from 'fs-extra';

const config = Conf.get();

/**
 * Logs out the user by deleting credentials.
 */
export default async (): Promise<void> => {
  if (config.auth && fs.existsSync(config.auth)) {
    fs.unlinkSync(config.auth);
  }
  if (config.authLocal && fs.existsSync(config.authLocal)) {
    fs.unlinkSync(config.authLocal);
  }
};
