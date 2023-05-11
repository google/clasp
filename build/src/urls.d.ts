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
export declare const extractScriptId: (scriptId: string) => string;
export declare const URL: {
    APIS: (projectId: string) => string;
    CREDS: (projectId: string) => string;
    LOGS: (projectId: string) => string;
    SCRIPT_API_USER: string;
    SCRIPT: (scriptId: string) => string;
    DRIVE: (driveId: string) => string;
};
