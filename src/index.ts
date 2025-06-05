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
 * @fileoverview Main executable entry point for the `clasp` Command Line Interface.
 * This file includes the shebang for node execution, sets up global error handling,
 * initializes the command-line argument parser (commander), and runs the main program.
 */

/**
 * clasp - The Apps Script CLI
 */
import Debug from 'debug';
import loudRejection from 'loud-rejection';

import {CommanderError} from 'commander';
import {makeProgram} from './commands/program.js';

const debug = Debug('clasp:cli');

// Suppress warnings about punycode and other issues often caused by transitive dependencies.
// These are generally not actionable by the end-user of clasp.
process.removeAllListeners('warning');

// Make sure any unhandled promise rejections are logged loudly to the console
// instead of failing silently. This helps in debugging.
loudRejection();

// Initialize the commander program which defines all CLI commands and options.
const program = makeProgram();

// Main execution block for the CLI.
try {
  debug('Running clasp with arguments: %s', process.argv.join(' '));
  // Parse command-line arguments and execute the appropriate command.
  // Commander.js handles routing to the correct subcommand action.
  await program.parseAsync(process.argv);
} catch (error) {
  // Catch and handle errors that occur during command parsing or execution.
  debug('An error occurred during clasp execution: %O', error);
  if (error instanceof CommanderError) {
    // CommanderError is usually handled by Commander itself (e.g., displaying help for unknown commands).
    // Logging here is for debug purposes; often no further action is needed for these.
    debug('CommanderError encountered (usually informational, already handled by commander): %s', error.message);
  } else if (error instanceof Error) {
    // For standard JavaScript errors, set an exit code and print the error message.
    process.exitCode = 1; // Indicate failure.
    console.error(error.message); // Show the error to the user.
  } else {
    // For unknown error types, set an exit code and log a generic error message.
    process.exitCode = 1;
    console.error('An unknown error occurred during execution.', error);
  }
}
