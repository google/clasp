import path from 'node:path';
import {Command} from 'commander';
import inflection from 'inflection';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';

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
  .command('create')
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
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;

    if (clasp.project.exists()) {
      this.error('Project file already exists.');
    }

    // Create defaults.
    const parentId: string | undefined = options.parentId;
    const name: string | undefined = getDefaultProjectName(process.cwd());
    const type: string = options.type ? options.type.toLowerCase() : 'standalone';
    const rootDir: string = options.rootDir ?? '.';

    clasp.withContentDir(rootDir);

    if (type && type !== 'standalone') {
      const mimeType = DRIVE_FILE_MIMETYPES[type];
      if (!mimeType) {
        this.error('Invalid container file type');
      }

      const {parentId} = await withSpinner(
        'Creating script...',
        async () => await clasp.project.createWithContainer(name, mimeType),
      );

      console.log(LOG.CREATE_DRIVE_FILE_FINISH(type, parentId));
    } else {
      const scriptId = await withSpinner(
        'Creating script...',
        async () => await clasp.project.createScript(name, parentId),
      );
      console.log(LOG.CREATE_PROJECT_FINISH(type, scriptId));
    }

    const files = await withSpinner('Cloning script...', async () => {
      const files = await clasp.files.pull();
      clasp.project.updateSettings();
      return files;
    });

    files.forEach(f => console.log(`└─ ${f.localPath}`));
    console.log(LOG.CLONE_SUCCESS(files.length));
  });

/**
 * Gets default project name.
 * @return {string} default project name.
 */
function getDefaultProjectName(dir: string) {
  const dirName = path.basename(dir);
  return inflection.humanize(dirName);
}
