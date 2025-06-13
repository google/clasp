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

// This file defines the 'create-script' (alias 'create') command for the clasp
// CLI.

import path from 'node:path';
import {Command} from 'commander';
import inflection from 'inflection';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

// https://developers.google.com/drive/api/v3/mime-types
const DRIVE_FILE_MIMETYPES: Record<string, string> = {
  docs: 'application/vnd.google-apps.document',
  forms: 'application/vnd.google-apps.form',
  sheets: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

interface CommandOption {
  readonly parentId?: string;
  readonly rootDir?: string;
  readonly title?: string;
  readonly type?: string;
}

export const command = new Command('create-script')
  .alias('create')
  .description('Create a script')
  .option(
    '--type <type>',
    'Creates a new Apps Script project attached to a new Document, Spreadsheet, Presentation, Form, or as a standalone script, web app, or API.',
    'standalone',
  )
  .option('--title <title>', 'The project title.')
  .option('--parentId <id>', 'A project parent Id.')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'Project file already exists.',
      });
      this.error(msg);
    }

    // Create defaults.
    const parentId: string | undefined = options.parentId;
    const name: string = options.title ? options.title : getDefaultProjectName(process.cwd());
    const type: string = options.type ? options.type.toLowerCase() : 'standalone';
    const rootDir: string = options.rootDir ?? '.';

    clasp.withContentDir(rootDir);

    // Handle container-bound script creation (e.g., for Sheets, Docs, Forms, Slides).
    if (type && type !== 'standalone') {
      const mimeType = DRIVE_FILE_MIMETYPES[type]; // Look up MIME type for the specified container type.
      if (!mimeType) {
        // If the type is invalid or not supported for container-bound scripts.
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid container file type',
        });
        this.error(msg);
      }

      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      // This call creates both the Google Drive file (e.g., a new Spreadsheet)
      // and the Apps Script project bound to it.
      const {parentId, scriptId} = await withSpinner(
        spinnerMsg,
        async () => await clasp.project.createWithContainer(name, mimeType),
      );
      const parentUrl = `https://drive.google.com/open?id=${parentId}`; // URL to the container file.
      const scriptUrl = `https://script.google.com/d/${scriptId}/edit`; // URL to the new Apps Script project.
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
      // Handle standalone script creation.
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      // This call creates a standalone Apps Script project.
      // If `parentId` is provided, it attempts to create it within that Drive folder.
      const scriptId = await withSpinner(spinnerMsg, async () => await clasp.project.createScript(name, parentId));
      const parentUrl = `https://drive.google.com/open?id=${parentId}`; // URL to parent folder if specified.
      const scriptUrl = `https://script.google.com/d/${scriptId}/edit`; // URL to the new Apps Script project.
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

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Cloning script...',
    });
    // After creating the script (either standalone or container-bound),
    // pull its initial files (e.g., Code.gs, appsscript.json) to the local directory.
    const files = await withSpinner(spinnerMsg, async () => {
      const files = await clasp.files.pull();
      // Update the local .clasp.json with the new scriptId and other settings.
      clasp.project.updateSettings();
      return files;
    });

    const outputAsJson = this.optsWithGlobals().json ?? false;
    if (outputAsJson) {
      const clonedFiles = files.map(f => f.localPath);
      // clasp.project.scriptId should be populated correctly by the create/pull operations
      const scriptId = clasp.project.scriptId;
      // options.parentId is the parent folder for standalone,
      // for container bound, the script's parentId is the container itself,
      // which is returned by createWithContainer and should be stored or passed.
      // However, the current structure doesn't retain the container's parentId in a straightforward way
      // to be available here for JSON output. We'll use options.parentId for now,
      // acknowledging it might be undefined for container-bound if not explicitly passed.
      // A more robust solution might involve returning parentId from the create logic.
      const finalParentId = clasp.project.parentId || options.parentId;

      console.log(
        JSON.stringify(
          {
            scriptId,
            parentId: finalParentId,
            clonedFiles,
          },
          null,
          2,
        ),
      );
    } else {
      // Log the paths of the pulled files.
      files.forEach(f => console.log(`└─ ${f.localPath}`));
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
    }
  });

/**
 * Generates a default project name based on the current directory's basename.
 * It humanizes the directory name (e.g., 'my-project-folder' becomes 'My project folder').
 * @param {string} dir - The directory path from which to derive the project name.
 * @returns {string} The humanized default project name.
 */
export function getDefaultProjectName(dir: string) {
  const dirName = path.basename(dir);
  return inflection.humanize(dirName);
}
