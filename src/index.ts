#!/usr/bin/env node

/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * clasp - The Apps Script CLI
 */
import Debug from 'debug';
import loudRejection from 'loud-rejection';

import {makeProgram} from './commands/program.js';

const debug = Debug('clasp:cli');

// Suppress warnings about punycode and other issues caused by dependencies
process.removeAllListeners('warning');

// Ensure any unhandled exception won't go unnoticed
loudRejection();

const program = makeProgram();

try {
  debug('Running clasp with args: %s', process.argv.join(' '));
  // User input is provided from the process' arguments
  await program.parseAsync(process.argv);
} catch (error) {
  debug('Error: %O', error);
  if (error instanceof Error) {
    process.exitCode = 1;
    console.error(error.message);
  } else {
    process.exitCode = 1;
    console.error('Unknown error', error);
  }
}
