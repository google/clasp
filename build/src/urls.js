import { SCRIPT_ID_LENGTH } from './apis.js';
/**
 * Extracts scriptId from URL if given in URL form.
 * @param scriptId {string} either a scriptId or URL containing the scriptId
 * @example
 * extractScriptId(
 * 'https://script.google.com/a/DOMAIN/d/1Ng7bNZ1K95wNi2H7IUwZzM68FL6ffxQhyc_ByV42zpS6qAFX8pFsWu2I/edit'
 * )
 * returns '1Ng7bNZ1K95wNi2H7IUwZzM68FL6ffxQhyc_ByV42zpS6qAFX8pFsWu2I'
 * @example
 * extractScriptId('1Ng7bNZ1K95wNi2H7IUwZzM68FL6ffxQhyc_ByV42zpS6qAFX8pFsWu2I')
 * returns '1Ng7bNZ1K95wNi2H7IUwZzM68FL6ffxQhyc_ByV42zpS6qAFX8pFsWu2I'
 */
export const extractScriptId = (scriptId) => {
    if (scriptId.length !== SCRIPT_ID_LENGTH) {
        const ids = scriptId.split('/').filter(s => s.length === SCRIPT_ID_LENGTH);
        if (ids.length > 0) {
            return ids[0];
        }
    }
    return scriptId;
};
// Helpers to get Apps Script project URLs
export const URL = {
    APIS: (projectId) => `https://console.developers.google.com/apis/dashboard?project=${projectId}`,
    CREDS: (projectId) => `https://console.developers.google.com/apis/credentials?project=${projectId}`,
    LOGS: (projectId) => `https://console.cloud.google.com/logs/viewer?project=${projectId}&resource=app_script_function`,
    SCRIPT_API_USER: 'https://script.google.com/home/usersettings',
    // It is too expensive to get the script URL from the Drive API. (Async/not offline)
    SCRIPT: (scriptId) => `https://script.google.com/d/${scriptId}/edit`,
    DRIVE: (driveId) => `https://drive.google.com/open?id=${driveId}`,
};
//# sourceMappingURL=urls.js.map