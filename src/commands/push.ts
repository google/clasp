import path from 'path';
import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

interface CommandOption {
  readonly watch?: boolean;
  readonly force?: boolean;
}

export const command = new Command('push')
  .description('Update the remote project')
  .option('-f, --force', 'Forcibly overwrites the remote manifest.')
  .option('-w, --watch', 'Watches for local file changes. Pushes when a non-ignored file changes.')
  .action(async function (this: Command, options: CommandOption) {
    const clasp: Clasp = this.opts().clasp;

    const watch = options.watch;
    let force = options.force;

    const onChange = async (paths: string[]) => {
      const isManifestUpdated = paths.findIndex(p => path.basename(p) === 'appsscript.json') !== -1;
      if (isManifestUpdated && !force) {
        force = await confirmManifestUpdate();
        if (!force) {
          const msg = intl.formatMessage({
            defaultMessage: 'Skipping push.',
          });
          console.log(msg);
          return;
        }
      }
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Pushing files...',
      });
      const files = await withSpinner(spinnerMsg, async () => {
        return await clasp.files.push();
      });
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Pushed {count, plural, 
        =0 {no files.}
        one {one file.}
        other {# files}}.`,
        },
        {
          count: files.length,
        },
      );
      console.log(successMessage);
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      return true;
    };

    const pendingChanges = await clasp.files.getChangedFiles();
    if (pendingChanges.length) {
      const paths = pendingChanges.map(f => f.localPath);
      await onChange(paths);
    } else {
      const msg = intl.formatMessage({
        defaultMessage: 'Script is already up to date.',
      });
      console.log(msg);
    }

    if (!watch) {
      return;
    }

    const onReady = async () => {
      const msg = intl.formatMessage({
        defaultMessage: 'Waiting for changes...',
      });
      console.log(msg);
    };

    const stopWatching = clasp.files.watchLocalFiles(onReady, async paths => {
      if (!(await onChange(paths))) {
        stopWatching();
      }
    });
  });

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
async function confirmManifestUpdate(): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const prompt = intl.formatMessage({
    defaultMessage: 'Manifest file has been updated. Do you want to push and overwrite?',
  });
  const answer = await inquirer.prompt([
    {
      default: false,
      message: prompt,
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
  return answer.overwrite;
}
