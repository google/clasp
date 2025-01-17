import {ClaspError} from '../clasp-error.js';
import {ProjectSettings} from '../dotfile.js';
import {ERROR} from '../messages.js';
import {getProjectSettings, saveProject} from '../utils.js';

/**
 * Gets or sets a setting in .clasp.json
 * @param {keyof ProjectSettings} settingKey The key to set
 * @param {string?} settingValue Optional value to set the key to
 */
export async function updateSettingCommand(settingKey?: keyof ProjectSettings, settingValue?: string): Promise<void> {
  const currentSettings = await getProjectSettings();

  // Display all settings if ran `clasp setting`.
  if (!settingKey) {
    console.log(currentSettings);
    return;
  }

  if (!settingValue) {
    if (!(settingKey in currentSettings)) {
      throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
    }
    const keyValue = currentSettings[settingKey] ?? '';
    // We don't use console.log as it automatically adds a new line
    // Which interferes with storing the value
    process.stdout.write(keyValue.toString());
    return;
  }

  const currentValue = settingKey in currentSettings ? currentSettings[settingKey] : '';
  // filePushOrder doesn't work since it requires an array.
  // const filePushOrder = settingKey === 'filePushOrder' ? settingValue : currentSettings.filePushOrder;
  if (!['fileExtension', 'projectId', 'rootDir', 'scriptId'].includes(settingKey)) {
    throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
  }

  Reflect.set(currentSettings, settingKey, settingValue);
  await saveProject(currentSettings, true);
  console.log(`Updated "${settingKey}": "${currentValue}" → "${settingValue}"`);
}
