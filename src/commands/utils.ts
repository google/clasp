import cliTruncate from 'cli-truncate';
import inquirer from 'inquirer';

import isReachable from 'is-reachable';
import open from 'open';
import ora from 'ora';
import pMap from 'p-map';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';

export async function maybePromptForProjectId(clasp: Clasp) {
  let projectId = clasp.project.getProjectId();
  if (!projectId && isInteractive()) {
    const answer = await inquirer.prompt([
      {
        message: `${LOG.ASK_PROJECT_ID}`,
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
    return;
  }
  return await open(url, {wait: false});
}
