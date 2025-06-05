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

/**
 * @fileoverview Provides utility functions shared across various `clasp` commands.
 * These include functions for asserting project configurations, handling user prompts,
 * displaying spinners during long operations, text formatting, and environment checks.
 */

import cliTruncate from 'cli-truncate';
import inquirer from 'inquirer';

import open from 'open';
import ora from 'ora';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';

/**
 * Asserts that a script ID is configured in the current project settings.
 * Throws an error if the script ID is not found.
 * @param clasp The Clasp instance containing project settings.
 */
export function assertScriptConfigured(clasp: Clasp): void {
  if (clasp.project.scriptId) {
    return; // Configured, do nothing.
  }

  // Not configured, throw an error.
  const msg = intl.formatMessage({
    defaultMessage: 'Script ID is not set in .clasp.json. Please run "clasp clone <scriptId>" or "clasp create" first.',
  });
  throw new Error(msg);
}

/**
 * Asserts that a Google Cloud Platform (GCP) project ID is configured.
 * Throws an error if the GCP project ID is not found.
 * @param clasp The Clasp instance containing project settings.
 */
export function assertGcpProjectConfigured(clasp: Clasp): void {
  if (clasp.project.projectId) {
    return; // Configured, do nothing.
  }

  // Not configured, throw an error.
  const msg = intl.formatMessage({
    defaultMessage: 'GCP project ID is not set in .clasp.json. Please run "clasp open-script" and associate a GCP project, or set it manually.',
  });
  throw new Error(msg);
}

/**
 * Prompts the user for a GCP project ID if it's not already configured and the session is interactive.
 * Updates the project settings if a project ID is provided by the user.
 * @param clasp The Clasp instance.
 * @returns A promise that resolves with the GCP project ID (either existing or newly entered), or undefined if not set and not interactive.
 */
export async function maybePromptForProjectId(clasp: Clasp): Promise<string | undefined> {
  let projectId = clasp.project.getProjectId(); // Attempt to get existing project ID.

  // If no project ID and in an interactive session, prompt the user.
  if (!projectId && isInteractive()) {
    assertScriptConfigured(clasp); // A script must exist to associate a GCP project.

    const scriptSettingsUrl = `https://script.google.com/home/projects/${clasp.project.scriptId}/settings`;
    const instructions = intl.formatMessage(
      {
        defaultMessage: `This script is not currently associated with a Google Cloud Platform (GCP) project.
To set up or view the GCP project for this script, please open:
{url}
Follow the instructions to associate a GCP project. If a project is already configured,
you can find its Project ID in the GCP console.`,
      },
      {url: scriptSettingsUrl},
    );
    console.log(instructions);
    await openUrl(scriptSettingsUrl); // Open the script settings page for the user.

    const promptMessage = intl.formatMessage({
      defaultMessage: 'Please enter the GCP project ID for this script (or press Enter to skip):',
    });
    const answers = await inquirer.prompt([
        {
          message: promptMessage,
          name: 'projectId',
          type: 'input', // Allows user to paste the project ID.
        },
      ]);

    // If the user provided a project ID, update the local project settings.
    if (answers.projectId) {
      projectId = answers.projectId.trim();
      await clasp.project.setProjectId(projectId);
      console.log(intl.formatMessage({defaultMessage: 'GCP project ID set to: {projectId}'}, {projectId}));
    } else {
      console.log(intl.formatMessage({defaultMessage: 'No GCP project ID entered. Some features requiring a GCP project may not work.'}));
    }
  }
  return projectId;
}

const spinner = ora(); // Singleton spinner instance.

/**
 * Executes an asynchronous function while displaying a CLI spinner.
 * The spinner is only shown if the terminal is interactive.
 * @param message The message to display next to the spinner.
 * @param fn The asynchronous function to execute.
 * @returns A promise that resolves with the result of the executed function.
 * @template T The return type of the asynchronous function.
 */
export async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  // Only show spinner in interactive terminals.
  if (!isInteractive()) {
    return fn();
  }

  spinner.start(message);
  try {
    return await fn(); // Execute the provided async function.
  } finally {
    // Ensure spinner stops regardless of success or failure.
    if (spinner.isSpinning) {
      spinner.stop();
    }
  }
}

/**
 * Truncates a string to a specified length with an ellipsis (...) if it exceeds that length.
 * It attempts to truncate at a space for better readability and pads the end to maintain consistent length.
 * @param value The string to ellipsize.
 * @param length The maximum desired length of the string (including ellipsis).
 * @returns The ellipsized and padded string.
 */
export function ellipsize(value: string, length: number): string {
  return cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
}

/**
 * Environment flags for clasp, primarily used for controlling behavior in tests
 * or different execution contexts.
 */
export const claspEnv = {
  /** Indicates if the current process is running in an interactive TTY context. */
  isInteractive: process.stdout.isTTY,
  /** Indicates if a web browser is likely available to open URLs. Assumes TTY implies browser presence. */
  isBrowserPresent: process.stdout.isTTY,
};

/**
 * Checks if the current session is interactive (i.e., running in a TTY).
 * @returns True if interactive, false otherwise.
 */
export function isInteractive(): boolean {
  return claspEnv.isInteractive;
}

/**
 * Opens a URL in the default web browser. If a browser is not detected (e.g., in a non-interactive CI environment),
 * it prints the URL to the console with instructions for the user to open it manually.
 * @param url The URL to open.
 * @returns A promise that resolves when the URL has been opened or printed.
 */
export async function openUrl(url: string): Promise<void> {
  if (!claspEnv.isBrowserPresent) {
    // If no browser is likely present, instruct the user to open the URL manually.
    const message = intl.formatMessage(
      {defaultMessage: 'Please open this URL in your browser to continue: {url}'},
      {url},
    );
    console.log(message);
    return;
  }

  // Attempt to open the URL in the default browser.
  const openingMessage = intl.formatMessage(
    {defaultMessage: 'Opening {url} in your browser...'},
    {url},
  );
  console.log(openingMessage);
  try {
    await open(url, {wait: false}); // `wait: false` allows clasp to continue without waiting for the browser tab to close.
  } catch (error) {
    // Handle errors during URL opening, e.g., no browser found or other system issues.
    const errorMsg = intl.formatMessage(
      {defaultMessage: 'Could not automatically open URL. Please open it manually: {url}'},
      {url},
    );
    console.error(errorMsg, error);
  }
}
