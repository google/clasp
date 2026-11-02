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

// This file defines the 'chat' command for configuring a Google Chat app
// via the Google Workspace Add-ons API.

import {Command} from 'commander';
import type {ChatAppConfigView} from '../core/chat.js';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {GlobalOptions, assertGcpProjectConfigured, maybePromptForProjectId, openUrl, withSpinner} from './utils.js';

interface ChatCommandOptions extends GlobalOptions {
  readonly open?: boolean;
  readonly file?: string;
  readonly view?: ChatAppConfigView;
  readonly updateMask?: string;
}

async function openChatApiConsole(clasp: Clasp, json?: boolean) {
  const projectId = await maybePromptForProjectId(clasp);
  assertGcpProjectConfigured(clasp);

  const url = new URL('https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat');
  url.searchParams.set('project', projectId ?? '');
  if (INCLUDE_USER_HINT_IN_URL) {
    const userHint = await clasp.authorizedUser();
    url.searchParams.set('authUser', userHint ?? '');
  }
  if (json) {
    console.log(JSON.stringify({url: url.toString()}, null, 2));
  }
  await openUrl(url.toString());
}

const getSubCommand = new Command('get')
  .description('Retrieve the current Google Chat app configuration.')
  .option('--view <view>', 'View of ChatAppConfig to return (BASIC or FULL)', 'FULL')
  .action(async function (this: Command) {
    const options: ChatCommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching Chat app configuration...',
    });
    const config = await withSpinner(spinnerMsg, async () => {
      return await clasp.chat.getConfig(options.view ?? 'FULL');
    });

    console.log(JSON.stringify(config, null, 2));
  });

const pullSubCommand = new Command('pull')
  .description('Download the Google Chat app configuration to chatapp.json.')
  .option('-f, --file <file>', 'Path to Chat app configuration JSON file (default: chatapp.json)')
  .option('--view <view>', 'View of ChatAppConfig to return (BASIC or FULL)', 'FULL')
  .action(async function (this: Command) {
    const options: ChatCommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Pulling Chat app configuration...',
    });
    const result = await withSpinner(spinnerMsg, async () => {
      return await clasp.chat.pullConfig(options.file, options.view ?? 'FULL');
    });

    if (options.json) {
      console.log(JSON.stringify({filePath: result.filePath, config: result.config}, null, 2));
      return;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Pulled Chat app configuration to {filePath}.',
      },
      {
        filePath: result.filePath,
      },
    );
    console.log(successMessage);
  });

const pushSubCommand = new Command('push')
  .alias('update')
  .description('Update the Google Chat app configuration from chatapp.json.')
  .option('-f, --file <file>', 'Path to Chat app configuration JSON file (default: chatapp.json)')
  .option('--updateMask <mask>', 'Comma-separated list of fields to update')
  .action(async function (this: Command) {
    const options: ChatCommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Updating Chat app configuration...',
    });
    const updated = await withSpinner(spinnerMsg, async () => {
      return await clasp.chat.pushConfig(options.file, options.updateMask);
    });

    if (options.json) {
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    const successMessage = intl.formatMessage({
      defaultMessage: 'Updated Chat app configuration.',
    });
    console.log(successMessage);
  });

const openSubCommand = new Command('open')
  .description('Open the Google Chat API Configuration page in the browser.')
  .action(async function (this: Command) {
    const options: ChatCommandOptions = this.optsWithGlobals();
    await openChatApiConsole(options.clasp, options.json);
  });

export const command = new Command('chat')
  .description('Configure a Google Chat app via the Google Workspace Add-ons API.')
  .option('--open', 'Open the Google Chat API Configuration page in the browser')
  .addCommand(getSubCommand)
  .addCommand(pullSubCommand)
  .addCommand(pushSubCommand)
  .addCommand(openSubCommand)
  .action(async function (this: Command) {
    const options: ChatCommandOptions = this.optsWithGlobals();
    if (options.open) {
      await openChatApiConsole(options.clasp, options.json);
      return;
    }
    this.help();
  });
