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

// This file defines the 'add-library' command for the clasp CLI.

import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly libraryVersion?: string;
  readonly symbol?: string;
  readonly dev?: boolean;
}

export const command = new Command('add-library')
  .description('Add a library to the project manifest.')
  .argument('<scriptId>', 'The script ID of the library to add')
  .option('-l, --libraryVersion <version>', 'The version of the library to use', '1')
  .option('-s, --symbol <symbol>', 'The identifier used to call the library from your script')
  .option('--dev', 'Use the development mode (HEAD) version of the library')
  .action(async function (this: Command, libraryId: string) {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

    const version = options.libraryVersion ?? '1';
    const userSymbol = options.symbol ?? libraryId.substring(0, 8);

    await clasp.project.addLibrary(libraryId, version, userSymbol, Boolean(options.dev));

    if (options.json) {
      console.log(JSON.stringify({success: true, libraryId, version, userSymbol}, null, 2));
      return;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Added library {userSymbol} ({libraryId}) version {version}.',
      },
      {
        userSymbol,
        libraryId,
        version,
      },
    );
    console.log(successMessage);
  });
