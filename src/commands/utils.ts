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

import cliTruncate from 'cli-truncate';
import inquirer from 'inquirer';

import open from 'open';
import ora from 'ora';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';

export function assertScriptConfigured(clasp: Clasp) {
  if (clasp.project.scriptId) {
    return;
  }

  const msg = intl.formatMessage({
    defaultMessage: 'Script ID is not set, unable to continue.',
  });
  throw new Error(msg);
}

export function assertGcpProjectConfigured(clasp: Clasp) {
  if (clasp.project.projectId) {
    return;
  }

  const msg = intl.formatMessage({
    defaultMessage: 'GCP project ID is not set, unable to continue.',
  });
  throw new Error(msg);
}

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

export function ellipsize(value: string, length: number) {
  return cliTruncate(value, length, {preferTruncationOnSpace: true}).padEnd(length);
}

// Exporting and wrapping to allow it to be toggled in tests
export const claspEnv = {
  isInteractive: process.stdout.isTTY,
  isBrowserPresent: process.stdout.isTTY,
};

export function isInteractive() {
  return claspEnv.isInteractive;
}

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
