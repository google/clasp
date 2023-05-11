import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Lists versions of an Apps Script project.
 */
export default async () => {
    await loadAPICredentials();
    spinner.start('Grabbing versions…');
    const { scriptId } = await getProjectSettings();
    const versionList = await getVersionList(scriptId);
    stopSpinner();
    const count = versionList.length;
    if (count === 0) {
        throw new ClaspError(LOG.DEPLOYMENT_DNE);
    }
    console.log(LOG.VERSION_NUM(count));
    versionList.reverse();
    for (const version of versionList) {
        console.log(LOG.VERSION_DESCRIPTION(version));
    }
};
const getVersionList = async (scriptId) => {
    let maxPages = 5;
    let pageToken;
    let list = [];
    do {
        const { data, status, statusText } = await script.projects.versions.list({ scriptId, pageSize: 200, pageToken });
        if (status !== 200) {
            throw new ClaspError(statusText);
        }
        const { nextPageToken, versions } = data;
        if (versions) {
            list = [...list, ...(versions !== null && versions !== void 0 ? versions : [])];
            pageToken = nextPageToken !== null && nextPageToken !== void 0 ? nextPageToken : undefined;
        }
    } while (pageToken && --maxPages);
    return list;
};
//# sourceMappingURL=versions.js.map