import cliTruncate from 'cli-truncate';
import inquirer from 'inquirer';

import isReachable from 'is-reachable';
import open from 'open';
import ora from 'ora';
import pMap from 'p-map';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';

export async function assertScriptConfigured(clasp: Clasp) {
  if (clasp.project.scriptId) {
    return;
  }

  const msg = intl.formatMessage({
    defaultMessage: 'Script ID is not set, unable to continue.',
  });
  throw new Error(msg);
}

export async function assertGcpProjectConfigured(clasp: Clasp) {
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

const mapper = async (url: string) => {
  return await isReachable(url, {timeout: 25_000});
};

/**
 * Checks if the network is available. Gracefully exits if not.
 */
// If using a proxy, return true since `isOnline` doesn't work.
// @see https://github.com/googleapis/google-api-nodejs-client#using-a-proxy
export async function safeIsOnline(): Promise<boolean> {
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    return true;
  }

  const urls = ['script.google.com', 'console.developers.google.com', 'console.cloud.google.com', 'drive.google.com'];

  const result = await pMap(urls, mapper, {stopOnError: false});

  return result.every(wasReached => wasReached);
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function checkIfOnlineOrDie() {
  if (await safeIsOnline()) {
    return true;
  }

  throw new Error('Unable to reach servers. Check your internet connection.', {
    cause: {
      code: 'NO_NETWORK',
    },
  });
}

export function isInteractive() {
  return process.stdout.isTTY;
}

export async function openUrl(url: string) {
  if (!isInteractive()) {
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
