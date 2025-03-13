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

    if (type && type !== 'standalone') {
      const mimeType = DRIVE_FILE_MIMETYPES[type];
      if (!mimeType) {
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid container file type',
        });
        this.error(msg);
      }

      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      const {parentId} = await withSpinner(
        spinnerMsg,
        async () => await clasp.project.createWithContainer(name, mimeType),
      );
      const url = `https://drive.google.com/open?id=${parentId}`;
      const successMessage = intl.formatMessage(
        {
          defaultMessage: 'Created new container: [url}',
        },
        {
          url,
        },
      );
      console.log(successMessage);
    } else {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Creating script...',
      });
      const scriptId = await withSpinner(spinnerMsg, async () => await clasp.project.createScript(name, parentId));

      const url = `https://script.google.com/d/${scriptId}/edit`;
      const successMessage = intl.formatMessage(
        {
          defaultMessage: 'Created new script: {url}',
        },
        {
          url,
        },
      );
      console.log(successMessage);
    }

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Cloning script...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      const files = await clasp.files.pull();
      clasp.project.updateSettings();
      return files;
    });

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
 * Gets default project name.
 * @return {string} default project name.
 */
export function getDefaultProjectName(dir: string) {
  const dirName = path.basename(dir);
  return inflection.humanize(dirName);
}
