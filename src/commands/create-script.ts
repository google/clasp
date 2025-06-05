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
 * @fileoverview Implements the `clasp create` command, which allows users to
 * create new Apps Script projects. It supports creating standalone scripts or
 * scripts bound to Google Workspace documents (Docs, Sheets, Slides, Forms).
 */

import path from 'node:path';
import {Command} from 'commander';
import inflection from 'inflection';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

/**
 * A map of Google Drive file types to their corresponding MIME types.
 * Used when creating container-bound scripts.
 * Source: https://developers.google.com/drive/api/v3/mime-types
 */
const DRIVE_FILE_MIMETYPES: Record<string, string> = {
  docs: 'application/vnd.google-apps.document',
  forms: 'application/vnd.google-apps.form',
  sheets: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

/**
 * Interface for the command options specific to the `create` command.
 */
interface CommandOption {
  /** The ID of the parent Google Drive file if creating a container-bound script. */
  readonly parentId?: string;
  /** Local root directory in which clasp will store the project files. */
  readonly rootDir?: string;
  /** The title of the new Apps Script project. */
  readonly title?: string;
  /** The type of script to create (e.g., 'standalone', 'sheets', 'docs'). */
  readonly type?: string;
}

/**
 * Command to create a new Apps Script project.
 * Can create standalone scripts or scripts bound to various Google Workspace document types.
 */
export const command = new Command('create-script')
  .alias('create')
  .description('Create a new Apps Script project, optionally bound to a Google Workspace document.')
  .option(
    '--type <type>',
    'Creates a new Apps Script project attached to a new Document, Spreadsheet, Presentation, Form, or as a standalone script, web app, or API.',
    'standalone',
  )
  .option('--title <title>', 'The title for the new Apps Script project.')
  .option('--parentId <id>', 'The Google Drive ID of a parent file to bind the script to (e.g., a Google Sheet).')
  .option('--rootDir <rootDir>', 'Local directory where the project files will be stored. Defaults to the current directory.')
  /**
   * Action handler for the `create` command.
   * @param options The command options.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    // Prevent overwriting an existing clasp project in the current directory.
    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'A .clasp.json project file already exists in this directory. Please use a different directory or delete the existing file.',
      });
      this.error(msg);
    }

    // Set defaults for options if not provided.
    const parentId: string | undefined = options.parentId;
    const title: string = options.title ?? getDefaultProjectName(process.cwd()); // Infer title from current directory if not given.
    const type: string = options.type?.toLowerCase() ?? 'standalone';
    const rootDir: string = options.rootDir ?? '.'; // Default to current directory.

    clasp.withContentDir(rootDir); // Configure clasp with the specified root directory.

    // Handle container-bound script creation.
    if (type !== 'standalone') {
      const mimeType = DRIVE_FILE_MIMETYPES[type]; // Get MIME type for the specified document type.
      if (!mimeType) {
        const msg = intl.formatMessage(
          {defaultMessage: 'Invalid container type: {type}. Supported types are: {supportedTypes}.'},
          {type, supportedTypes: Object.keys(DRIVE_FILE_MIMETYPES).join(', ')},
        );
        this.error(msg);
      }

      const creatingMsg = intl.formatMessage(
        {defaultMessage: 'Creating new {type} and Apps Script project "{title}"...'},
        {type, title},
      );
      const {parentId: newParentId, scriptId} = await withSpinner(
        creatingMsg,
        async () => clasp.project.createWithContainer(title, mimeType),
      );
      const parentUrl = `https://drive.google.com/open?id=${newParentId}`;
      const scriptUrl = `https://script.google.com/d/${scriptId}/edit`;
      const successMessage = intl.formatMessage(
        {
          defaultMessage: 'Created new document: {parentUrl}{br}Created new script: {scriptUrl}',
        },
        {
          parentUrl,
          scriptUrl,
          br: '\n',
        },
      );
      console.log(successMessage);
    } else {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating new standalone Apps Script project "{title}"...'},
        {title},
      );
      const scriptId = await withSpinner(creatingMsg, async () => clasp.project.createScript(title, parentId));
      const parentUrl = parentId ? `https://drive.google.com/open?id=${parentId}` : '';
      const scriptUrl = `https://script.google.com/d/${scriptId}/edit`;
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Created new script: {scriptUrl}{parentId, select,
            undefined {}
            other {{br}Bound to document: {parentUrl}}
          }`,
        },
        {
          parentId,
          parentUrl,
          scriptUrl,
          br: '\n',
        },
      );
      console.log(successMessage);
    }

    // After creating the script (either standalone or bound), pull its files and update local settings.
    const cloningMsg = intl.formatMessage({
      defaultMessage: 'Cloning project files...',
    });
    const files = await withSpinner(cloningMsg, async () => {
      const pulledFiles = await clasp.files.pull(); // Pull files from the newly created project.
      await clasp.project.updateSettings(); // Create/update .clasp.json with the new scriptId and settings.
      return pulledFiles;
    });

    files.forEach(f => console.log(`└─ ${f.localPath}`)); // Display pulled files.
    const successMessage = intl.formatMessage(
      {
        defaultMessage: `Cloned {count, plural, 
        =0 {no files.}
        one {one file.}
        other {# files}}.`,
      },
      {
        count: files.length,
      },
    );
    console.log(successMessage);
  });

/**
 * Generates a default project name based on the basename of the provided directory.
 * It humanizes the directory name (e.g., 'my-project-dir' becomes 'My project dir').
 * @param dir The directory path from which to derive the project name.
 * @return {string} The default project name.
 */
export function getDefaultProjectName(dir: string): string {
  const dirName = path.basename(dir);
  return inflection.humanize(dirName);
}
