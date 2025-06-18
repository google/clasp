// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file contains utility functions for the clasp CLI commands, such as
// spinners, URL opening, and configuration assertions.

import cliTruncate from 'cli-truncate';
import inquirer from 'inquirer';

import open from 'open';
import ora from 'ora';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';

/**
 * Asserts that a script project is configured by checking for a script ID.
 * Throws an error if the script ID is not set.
 * @param {Clasp} clasp - The Clasp instance containing project details.
 * @throws {Error} If `clasp.project.scriptId` is not set.
 */
export function assertScriptConfigured(clasp: Clasp) {
  if (clasp.project.scriptId) {
    return;
  }

  const msg = intl.formatMessage({
    defaultMessage: 'Script ID is not set, unable to continue.',
  });
  throw new Error(msg);
}

/**
 * Asserts that a Google Cloud Platform (GCP) project is configured by checking for a project ID.
 * Throws an error if the GCP project ID is not set.
 * @param {Clasp} clasp - The Clasp instance containing project details.
 * @throws {Error} If `clasp.project.projectId` is not set.
 */
export function assertGcpProjectConfigured(clasp: Clasp) {
  if (clasp.project.projectId) {
    return;
  }

  const msg = intl.formatMessage({
    defaultMessage: 'GCP project ID is not set, unable to continue.',
  });
  throw new Error(msg);
}

/**
 * Prompts the user for a Google Cloud Platform (GCP) project ID if one is not already configured
 * and the environment is interactive. It opens the script's GCP settings page in the browser
 * to help the user find their project ID.
 * @param {Clasp} clasp - The Clasp instance.
 * @returns {Promise<string | undefined>} The GCP project ID if available or entered by the user, otherwise undefined.
 */
export async function maybePromptForProjectId(clasp: Clasp) {
  let projectId = clasp.project.getProjectId();
  if (!projectId && isInteractive()) {
    assertScriptConfigured(clasp);

    const url = `https://script.google.com/home/projects/${clasp.project.scriptId}/settings`;
    const instructions = intl.formatMessage(
      {
        defaultMessage: `The script is not bound to a GCP project. To view or configure the GCP project for this
      script, open {url} in your browser and follow instructions for setting up a GCP project. If a project is already
      configured, open the GCP project to get the project ID value.`,
      },
      {
        url,
      },
    );
    console.log(instructions);
    await openUrl(url);

    const prompt = intl.formatMessage({
      defaultMessage: 'What is your GCP projectId?',
    });
    const answer = await inquirer.prompt([
      {
        message: prompt,
        name: 'projectId',
        type: 'input',
      },
    ]);
    projectId = answer.projectId;
    await clasp.project.setProjectId(projectId);
  }
  return projectId;
}

const spinner = ora();
/**
 * Executes an asynchronous function while displaying a spinner in the console.
 * The spinner is only shown if the environment is interactive.
 * @template T
 * @param {string} message - The message to display next to the spinner.
 * @param {() => Promise<T>} fn - The asynchronous function to execute.
 * @returns {Promise<T>} A promise that resolves with the result of the executed function.
 */
export async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  // If not interactive terminal, skip spinner
  if (!isInteractive()) {
    return await fn();
  }

  spinner.start(message);
  try {
    return await fn();
  } finally {
    if (spinner.isSpinning) {
      spinner.stop();
    }
  }
}

/**
 * Truncates a string to a specified length with an ellipsis if it exceeds the length.
 * It attempts to truncate on a space and pads the end to maintain the specified length.
 * @param {string} value - The string to ellipsize.
 * @param {number} length - The maximum length of the string.
 * @returns {string} The ellipsized string.
 */
export function ellipsize(value: string, length: number) {
  return cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
}

/**
 * Environment flags for clasp, primarily used for testing purposes
 * to simulate or disable interactive states or browser presence.
 * @property {boolean} isInteractive - Whether the current environment is an interactive TTY.
 * @property {boolean} isBrowserPresent - Whether a browser is considered available to open URLs.
 */
// Exporting and wrapping to allow it to be toggled in tests
export const claspEnv = {
  isInteractive: process.stdout.isTTY,
  isBrowserPresent: process.stdout.isTTY,
};

/**
 * Checks if the current environment is interactive (i.e., a TTY).
 * Relies on `claspEnv.isInteractive`.
 * @returns {boolean} True if interactive, false otherwise.
 */
export function isInteractive() {
  return claspEnv.isInteractive;
}

/**
 * Opens a URL in the default web browser if available.
 * If a browser is not considered present (e.g., in some CI environments, or for testing),
 * it logs a message asking the user to open the URL manually.
 * @param {string} url - The URL to open.
 * @returns {Promise<void | import('open').ChildProcess>} A promise that resolves when the URL is opened,
 * or void if a browser is not present. The child process from `open` is returned if a browser is used.
 */
export async function openUrl(url: string) {
  if (!claspEnv.isBrowserPresent) {
    const msg = intl.formatMessage(
      {
        defaultMessage: 'Open {url} in your browser to continue.',
      },
      {
        url,
      },
    );
    console.log(msg);
    return;
  }
  const msg = intl.formatMessage(
    {
      defaultMessage: 'Opening {url} in your browser.',
    },
    {
      url,
    },
  );
  console.log(msg);
  return await open(url, {wait: false});
}
