import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-standalone';
import type {ChoiceOrSeparatorArray} from 'inquirer-autocomplete-standalone';

import {LOG} from './messages.js';

export type functionNameSource = (input?: string) => Promise<ChoiceOrSeparatorArray<string>>;

/**
 * Inquirer prompt for a functionName.
 * @returns {Promise<{ functionName: string }>} A promise for an object with the `functionName` property.
 */
export function functionNamePrompt(source: functionNameSource): Promise<string> {
  return autocomplete({
    message: 'Select a functionName',
    source,
  });
}

export interface PromptAnswers {
  doAuth: boolean; // In sync with prompt
  localhost: boolean; // In sync with prompt
}

// /**
//  * Inquirer prompt for oauth scopes.
//  * @returns {Promise<PromptAnswers>} A promise for an object with the `PromptAnswers` interface.
//  */
// export const oauthScopesPrompt = () =>
//   prompt<PromptAnswers>([
//     {
//       message: 'Authorize new scopes?',
//       name: 'doAuth',
//       type: 'confirm',
//     },
//     {
//       message: 'Use localhost?',
//       name: 'localhost',
//       type: 'confirm',
//       when: (answers: Readonly<PromptAnswers>) => answers.doAuth,
//     },
//   ]);

/**
 * Inquirer prompt for overwriting a manifest.
 * @returns {Promise<{ overwrite: boolean }>} A promise for an object with the `overwrite` property.
 */
export function overwritePrompt(): Promise<{overwrite: boolean}> {
  return inquirer.prompt<{overwrite: boolean}>([
    {
      default: false,
      message: 'Manifest file has been updated. Do you want to push and overwrite?',
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
}

/**
 * Inquirer prompt for project Id.
 * @returns {Promise<{ projectId: string }>} A promise for an object with the `projectId` property.
 */
export function projectIdPrompt(): Promise<{projectId: string}> {
  return inquirer.prompt<{readonly projectId: string}>([
    {
      message: `${LOG.ASK_PROJECT_ID}`,
      name: 'projectId',
      type: 'input',
    },
  ]);
}

export interface ScriptIdPrompt {
  name: string;
  value: string;
}

/**
 * Inquirer prompt for authorization URL.
 * @returns {Promise<{ url: string }>} A promise for an object with the `type` property.
 */
export function authorizationCompletePrompt(): Promise<{url: string}> {
  return inquirer.prompt<{url: string}>([
    {
      message: 'Enter the URL from your browser after completing authorization',
      name: 'url',
      type: 'input',
    },
  ]);
}
