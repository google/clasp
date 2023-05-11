import { drive, loadAPICredentials } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { ERROR, LOG } from '../messages.js';
import { URL } from '../urls.js';
import { ellipsize, spinner, stopSpinner } from '../utils.js';
/**
 * Lists a user's Apps Script projects using Google Drive.
 * @param options.noShorten {boolean}
 */
export default async (options) => {
    var _a;
    await loadAPICredentials();
    spinner.start(LOG.FINDING_SCRIPTS);
    const { data: { files = [] }, status, } = await drive.files.list({
        pageSize: 50,
        // Fields isn't currently supported
        // https://github.com/googleapis/google-api-nodejs-client/issues/1374
        // fields: 'nextPageToken, files(id, name)',
        q: 'mimeType="application/vnd.google-apps.script"',
    });
    if (status !== 200) {
        throw new ClaspError(ERROR.DRIVE);
    }
    stopSpinner();
    if (files.length > 0) {
        for (const file of files) {
            console.log(`${options.noShorten ? file.name : ellipsize(file.name, 20)} - ${URL.SCRIPT((_a = file.id) !== null && _a !== void 0 ? _a : '')}`);
        }
    }
    else {
        console.log(LOG.FINDING_SCRIPTS_DNE);
    }
};
//# sourceMappingURL=list.js.map