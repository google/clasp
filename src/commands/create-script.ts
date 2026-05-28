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
import {GlobalOptions, withSpinner} from './utils.js';

// https://developers.google.com/drive/api/v3/mime-types
const DRIVE_FILE_MIMETYPES: Record<string, string> = {
  docs: 'application/vnd.google-apps.document',
  forms: 'application/vnd.google-apps.form',
  sheets: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

// Types that produce a standalone script. `webapp` and `api` are accepted as
// aliases of `standalone` because clasp's `--type` only controls how the
// script is *created*; deploying it as a web app or API executable happens
// separately via `clasp create-deployment`.
const STANDALONE_SCRIPT_TYPES: ReadonlySet<string> = new Set(['standalone', 'webapp', 'api']);

interface CommandOptions extends GlobalOptions {
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
  .action(async function (this: Command): Promise<void> {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;

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

    let scriptId: string;
    let createdParentId: string | undefined;

    // Handle container-bound script creation (e.g., for Sheets, Docs, Forms, Slides).
    if (!STANDALONE_SCRIPT_TYPES.has(type)) {
      const mimeType = DRIVE_FILE_MIMETYPES[type]; // Look up MIME type for the specified container type.
      if (!mimeType) {
        // If the type is not one of the known standalone or container-bound types.
        const validTypes = [...STANDALONE_SCRIPT_TYPES, ...Object.keys(DRIVE_FILE_MIMETYPES)].join(', ');
        const msg = intl.formatMessage(
          {
            defaultMessage: 'Invalid script type "{type}". Valid types are: {validTypes}.',
          },
          {type, validTypes},
        );
        this.error(msg);
      }

      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      // This call creates both the Google Drive file (e.g., a new Spreadsheet)
      // and the Apps Script project bound to it.
      const result = await withSpinner(spinnerMsg, async () => await clasp.project.createWithContainer(name, mimeType));
      scriptId = result.scriptId;
      createdParentId = result.parentId;
      if (!options.json) {
        const parentUrl = `https://drive.google.com/open?id=${createdParentId}`; // URL to the container file.
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
      }
    } else {
      // Handle standalone script creation.
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      // This call creates a standalone Apps Script project.
      // If `parentId` is provided, it attempts to create it within that Drive folder.
      scriptId = await withSpinner(spinnerMsg, async () => await clasp.project.createScript(name, parentId));
      if (!options.json) {
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

        // Surface the next step for users who asked for a web app or API
        // executable. The script itself is always created as standalone;
        // exposing it as a web app or API happens at deployment time.
        if (type === 'webapp' || type === 'api') {
          const deploymentKind = type === 'webapp' ? 'web app' : 'API executable';
          const manifestField = type === 'webapp' ? 'webApp' : 'executionApi';
          const deploymentTip = intl.formatMessage(
            {
              defaultMessage:
                'Tip: to deploy this script as a {deploymentKind}, configure "{manifestField}" in appsscript.json and run `clasp create-deployment`.',
            },
            {deploymentKind, manifestField},
          );
          console.log(deploymentTip);
        }
      }
    }

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Cloning script...',
    });
    // After creating the script (either standalone or container-bound),
    // pull its initial files (e.g., Code.gs, appsscript.json) to the local directory.
    const files = await withSpinner(spinnerMsg, async () => {
      const files = await clasp.files.pull();
      // Update the local .clasp.json with the new scriptId and other settings.
      await clasp.project.updateSettings();
      return files;
    });

    if (options.json) {
      console.log(JSON.stringify({scriptId, parentId: createdParentId, files: files.map(f => f.localPath)}, null, 2));
      return;
    }

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
