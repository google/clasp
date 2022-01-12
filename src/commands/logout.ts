import fs from 'fs-extra';

import {Conf} from '../conf.js';

const config = Conf.get();

const deleteIfExists = (file: string | undefined) => {
  if (file && fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};

/**
 * Logs out the user by deleting credentials.
 */
export default async (): Promise<void> => {
  deleteIfExists(config.auth);
  deleteIfExists(config.authLocal);
};
