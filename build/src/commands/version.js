import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { descriptionPrompt } from '../inquirer.js';
import { LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Creates a new version of an Apps Script project.
 */
export default async (description) => {
    var _a;
    await loadAPICredentials();
    const { scriptId } = await getProjectSettings();
    description = description !== null && description !== void 0 ? description : (await descriptionPrompt()).description;
    spinner.start(LOG.VERSION_CREATE);
    const { data, status, statusText } = await script.projects.versions.create({ scriptId, requestBody: { description } });
    if (status !== 200) {
        throw new ClaspError(statusText);
    }
    stopSpinner();
    console.log(LOG.VERSION_CREATED((_a = data.versionNumber) !== null && _a !== void 0 ? _a : -1));
};
//# sourceMappingURL=version.js.map