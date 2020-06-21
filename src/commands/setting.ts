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
  const currentSettings = await getProjectSettings();

  // Display all settings if ran `clasp setting`.
  if (!settingKey) {
    console.log(currentSettings);
    return;
  }

  // Make a new spinner piped to stdErr so we don't interfere with output
  if (!settingValue) {
    if (settingKey in currentSettings) {
      let keyValue = currentSettings[settingKey] ?? '';
      if (Array.isArray(keyValue)) {
        keyValue = keyValue.toString();
      }

      // We don't use console.log as it automatically adds a new line
      // Which interfers with storing the value
      process.stdout.write(keyValue);
    } else {
      throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
    }

    return;
  }

  try {
    const currentValue = settingKey in currentSettings ? currentSettings[settingKey] : '';
    // filePushOrder doesn't work since it requires an array.
    // const filePushOrder = settingKey === 'filePushOrder' ? settingValue : currentSettings.filePushOrder;
    if (['fileExtension', 'projectId', 'rootDir', 'scriptId'].includes(settingKey)) {
      Reflect.set(currentSettings, settingKey, settingValue);
      await saveProject(currentSettings, true);
      console.log(`Updated "${settingKey}": "${currentValue}" → "${settingValue}"`);
    } else {
      throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
    }
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError('Unable to update .clasp.json');
  }
};
