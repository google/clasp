import {script_v1 as scriptV1} from 'googleapis';
import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-prompt-ipt';
import type {ReadonlyDeep} from 'type-fest';

import {SCRIPT_TYPES} from './apis.js';
import {LOG} from './messages.js';

const {prompt, registerPrompt} = inquirer;

registerPrompt('autocomplete', autocomplete);

export type functionNameSource = (
  answers: {readonly functionName: string},
  input?: string | undefined
) => Promise<string[]>;

/**
 * Inquirer prompt for a functionName.
 * @returns {Promise<{ functionName: string }>} A promise for an object with the `functionName` property.
 */
export const functionNamePrompt = (source: functionNameSource) =>
  prompt<{functionName: string}>([
    {
      name: 'functionName',
      message: 'Select a functionName',
      type: 'autocomplete',
      source,
    },
  ]);

export interface DeploymentIdPromptChoice {
  name: string;
  value: scriptV1.Schema$Deployment;
}

/**
 * Inquirer prompt for a deployment Id.
 * @param {DeploymentIdChoice[]} choices An array of `DeploymentIdChoice` objects.
 * @returns {Promise<{ deploymentId: string }>} A promise for an object with the `deploymentId` property.
 */
export const deploymentIdPrompt = (choices: ReadonlyArray<ReadonlyDeep<DeploymentIdPromptChoice>>) =>
  prompt<{deployment: scriptV1.Schema$Deployment}>([
    {
      choices,
      message: 'Open which deployment?',
      name: 'deployment',
      type: 'list',
    },
  ]);

/**
 * Inquirer prompt for a project description.
 * @returns {Promise<{ description: string }>} A promise for an object with the `description` property.
 */
export const descriptionPrompt = () =>
  prompt<{description: string}>([
    {
      default: '',
      message: LOG.GIVE_DESCRIPTION,
      name: 'description',
      type: 'input',
    },
  ]);

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
export const overwritePrompt = () =>
  prompt<{overwrite: boolean}>([
    {
      default: false,
      message: 'Manifest file has been updated. Do you want to push and overwrite?',
      name: 'overwrite',
      type: 'confirm',
    },
  ]);

/**
 * Inquirer prompt for project Id.
 * @returns {Promise<{ projectId: string }>} A promise for an object with the `projectId` property.
 */
export const projectIdPrompt = () =>
  prompt<{readonly projectId: string}>([
    {
      message: `${LOG.ASK_PROJECT_ID}`,
      name: 'projectId',
      type: 'input',
    },
  ]);

export interface ScriptIdPrompt {
  name: string;
  value: string;
}

/**
 * Inquirer prompt for script Id.
 * @param {ScriptIdPrompt[]} fileIds An array of `ScriptIdPrompt` objects.
 * @returns {Promise<{scriptId: string;}>} A promise for an object with the `scriptId` property.
 */
export const scriptIdPrompt = (fileIds: ReadonlyArray<Readonly<ScriptIdPrompt>>) =>
  prompt<{scriptId: string}>([
    {
      choices: fileIds,
      message: LOG.CLONE_SCRIPT_QUESTION,
      name: 'scriptId',
      pageSize: 30,
      type: 'list',
    },
  ]);

/**
 * Inquirer prompt for script type.
 * @returns {Promise<{ type: string }>} A promise for an object with the `type` property.
 */
export const scriptTypePrompt = () =>
  prompt<{type: string}>([
    {
      choices: Object.keys(SCRIPT_TYPES).map(key => SCRIPT_TYPES[key as keyof typeof SCRIPT_TYPES]),
      message: LOG.CREATE_SCRIPT_QUESTION,
      name: 'type',
      type: 'list',
    },
  ]);
