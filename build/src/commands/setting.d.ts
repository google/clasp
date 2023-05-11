import { ProjectSettings } from '../dotfile.js';
declare const _default: (settingKey?: keyof ProjectSettings | undefined, settingValue?: string | undefined) => Promise<void>;
/**
 * Gets or sets a setting in .clasp.json
 * @param {keyof ProjectSettings} settingKey The key to set
 * @param {string?} settingValue Optional value to set the key to
 */
export default _default;
