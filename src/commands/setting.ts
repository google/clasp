import {Command} from 'commander';

import {ClaspError} from '../clasp-error.js';
import {Context, Settings, assertScriptSettings} from '../context.js';
import {ERROR} from '../messages.js';
import {saveProject} from '../utils.js';

/**
 * Gets or sets a setting in .clasp.json
 * @param {keyof ProjectSettings} settingKey The key to set
 * @param {string?} settingValue Optional value to set the key to
 */
export async function updateSettingCommand(
  this: Command,
  settingKey?: keyof Settings,
  settingValue?: string,
): Promise<void> {
  const context: Context = this.opts().context;
  assertScriptSettings(context);

  // Display all settings if ran `clasp setting`.
  if (!settingKey) {
    console.log(context.project.settings);
    return;
  }

  if (!settingValue) {
    if (!(settingKey in context.project.settings)) {
      throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
    }
    const keyValue = context.project.settings[settingKey] ?? '';
    // We don't use console.log as it automatically adds a new line
    // Which interferes with storing the value
    process.stdout.write(keyValue.toString());
    return;
  }

  const currentValue = settingKey in context.project.settings ? context.project.settings[settingKey] : '';
  // filePushOrder doesn't work since it requires an array.
  // const filePushOrder = settingKey === 'filePushOrder' ? settingValue : currentSettings.filePushOrder;
  if (!['fileExtension', 'projectId', 'rootDir', 'scriptId'].includes(settingKey)) {
    throw new ClaspError(ERROR.UNKNOWN_KEY(settingKey));
  }

  Reflect.set(context.project.settings, settingKey, settingValue);
  await saveProject(context.project);
  console.log(`Updated "${settingKey}": "${currentValue}" → "${settingValue}"`);
}
