/* eslint-disable new-cap */
import {ClaspError} from '../clasp-error';
import {ProjectSettings} from '../dotfile';
import {ERROR} from '../messages';
import {getProjectSettings, saveProject} from '../utils';

/**
 * Gets or sets a setting in .clasp.json
 * @param {keyof ProjectSettings} settingKey The key to set
 * @param {string?} settingValue Optional value to set the key to
 */
export default async (settingKey?: keyof ProjectSettings, settingValue?: string): Promise<void> => {
  let currentSettings = await getProjectSettings();

  // Display all settings if ran `clasp setting`.
  if (!settingKey) {
    console.log(currentSettings);
    return;
  }

  // Make a new spinner piped to stdErr so we don't interfere with output
  if (!settingValue) {
    if (settingKey in currentSettings) {
      let keyValue = currentSettings[settingKey];
      if (Array.isArray(keyValue)) {
        keyValue = keyValue.toString();
      } else if (typeof keyValue !== 'string') {
        keyValue = '';
      }
      // We don't use console.log as it automatically adds a new line
      // Which interfers with storing the value
      process.stdout.write(keyValue);
    } else {
      throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
    }
  } else {
    try {
      currentSettings = await getProjectSettings();
      const currentValue = settingKey in currentSettings ? currentSettings[settingKey] : '';
      switch (settingKey) {
        case 'scriptId':
          currentSettings.scriptId = settingValue;
          break;
        case 'rootDir':
          currentSettings.rootDir = settingValue;
          break;
        case 'projectId':
          currentSettings.projectId = settingValue;
          break;
        case 'fileExtension':
          currentSettings.fileExtension = settingValue;
          break;
        default:
          throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
      }
      // filePushOrder doesn't work since it requires an array.
      // const filePushOrder = settingKey === 'filePushOrder' ? settingValue : currentSettings.filePushOrder;
      await saveProject(currentSettings, true);
      console.log(`Updated "${settingKey}": "${currentValue}" → "${settingValue}"`);
    } catch (error) {
      if (error instanceof ClaspError) throw error;
      throw new ClaspError('Unable to update .clasp.json');
    }
  }
};
