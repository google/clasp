import {script_v1 as scriptV1} from 'googleapis';
import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-standalone';
import type {ChoiceOrSeparatorArray} from 'inquirer-autocomplete-standalone';
import type {ReadonlyDeep} from 'type-fest';

import {SCRIPT_TYPES} from './apis.js';
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

export interface DeploymentIdPromptChoice {
  name: string;
  value: scriptV1.Schema$Deployment;
}

/**
 * Inquirer prompt for a deployment Id.
 * @param {DeploymentIdChoice[]} choices An array of `DeploymentIdChoice` objects.
 * @returns {Promise<{ deploymentId: string }>} A promise for an object with the `deploymentId` property.
 */
export function deploymentIdPrompt(
  choices: ReadonlyArray<ReadonlyDeep<DeploymentIdPromptChoice>>,
): Promise<{deployment: scriptV1.Schema$Deployment}> {
  return inquirer.prompt<{deployment: scriptV1.Schema$Deployment}>([
    {
      choices,
      message: 'Open which deployment?',
      name: 'deployment',
      type: 'list',
    },
  ]);
}

/**
 * Inquirer prompt for a project description.
 * @returns {Promise<{ description: string }>} A promise for an object with the `description` property.
 */
export function descriptionPrompt(): Promise<{description: string}> {
  return inquirer.prompt<{description: string}>([
    {
      default: '',
      message: LOG.GIVE_DESCRIPTION,
      name: 'description',
      type: 'input',
    },
  ]);
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
 * Inquirer prompt for script Id.
 * @param {ScriptIdPrompt[]} fileIds An array of `ScriptIdPrompt` objects.
 * @returns {Promise<{scriptId: string;}>} A promise for an object with the `scriptId` property.
 */
export function scriptIdPrompt(fileIds: ReadonlyArray<Readonly<ScriptIdPrompt>>): Promise<{scriptId: string}> {
  return inquirer.prompt<{scriptId: string}>([
    {
      choices: fileIds,
      message: LOG.CLONE_SCRIPT_QUESTION,
      name: 'scriptId',
      pageSize: 30,
      type: 'list',
    },
  ]);
}

/**
 * Inquirer prompt for script type.
 * @returns {Promise<{ type: string }>} A promise for an object with the `type` property.
 */
export function scriptTypePrompt(): Promise<{type: string}> {
  return inquirer.prompt<{type: string}>([
    {
      choices: Object.keys(SCRIPT_TYPES).map(key => SCRIPT_TYPES[key as keyof typeof SCRIPT_TYPES]),
      message: LOG.CREATE_SCRIPT_QUESTION,
      name: 'type',
      type: 'list',
    },
  ]);
}

/**
 * Inquirer prompt for authorization URL.
 * @returns {Promise<{ url: string }>} A promise for an object with the `type` property.
 */
export function authorizationCompletePrompt(): Promise<{url: string}> {
  return inquirer.prompt<{url: string}>([
    {
      choices: Object.keys(SCRIPT_TYPES).map(key => SCRIPT_TYPES[key as keyof typeof SCRIPT_TYPES]),
      message: 'Enter the URL from your browser after completing authorization',
      name: 'url',
      type: 'input',
    },
  ]);
}
