// Helpers to get Apps Script project URLs
export const URL = {
  APIS: (projectId: string) => `https://console.developers.google.com/apis/dashboard?project=${projectId}`,
  CREDS: (projectId: string) => `https://console.developers.google.com/apis/credentials?project=${projectId}`,
  LOGS: (projectId: string) =>
    `https://console.cloud.google.com/logs/viewer?project=${projectId}&resource=app_script_function`,
  SCRIPT_API_USER: 'https://script.google.com/home/usersettings',
  // It is too expensive to get the script URL from the Drive API. (Async/not offline)
  SCRIPT: (scriptId: string) => `https://script.google.com/d/${scriptId}/edit`,
  DRIVE: (driveId: string) => `https://drive.google.com/open?id=${driveId}`,
};
