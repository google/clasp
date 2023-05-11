import fs from 'fs-extra';
import { Conf } from '../conf.js';
const config = Conf.get();
const deleteIfExists = (file) => {
    if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
};
/**
 * Logs out the user by deleting credentials.
 */
export default async () => {
    deleteIfExists(config.auth);
    deleteIfExists(config.authLocal);
};
//# sourceMappingURL=logout.js.map