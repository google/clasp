import path from 'path';
import {Command} from 'commander';
import inquirer from 'inquirer';

import {LOG} from '../messages.js';

import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, isInteractive, withSpinner} from './utils.js';

interface CommandOption {
  readonly watch?: boolean;
  readonly force?: boolean;
}

export const command = new Command('push')
  .description('Update the remote project')
  .option('-f, --force', 'Forcibly overwrites the remote manifest.')
  .option('-w, --watch', 'Watches for local file changes. Pushes when a non-ignored file changes.')
  .action(pushAction);

async function pushAction(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const clasp: Clasp = this.opts().clasp;

  const watch = options.watch;
  let force = options.force;

  const onChange = async (paths: string[]) => {
    const isManifestUpdated = paths.findIndex(p => path.basename(p) === 'appsscript.json') !== -1;
    if (isManifestUpdated && !force) {
      force = await confirmManifestUpdate();
      if (!force) {
        console.log('Skipping push.');
      }
    }
    const files = await withSpinner(LOG.PUSHING, async () => {
      return await clasp.files.push();
    });
    console.log(`Pushed ${files.length} files.`);
    files.forEach(f => console.log(`└─ ${f.localPath}`));
    return true;
  };

  const pendingChanges = await clasp.files.getChangedFiles();
  if (pendingChanges.length) {
    const paths = pendingChanges.map(f => f.localPath);
    await onChange(paths);
  } else {
    console.log('Script is already up to date.');
  }

  if (!watch) {
    return;
  }

  console.log(LOG.PUSH_WATCH);

  const onReady = async () => {
    console.log('Waiting for changes...');
  };

  const stopWatching = clasp.files.watchLocalFiles(onReady, async paths => {
    if (!(await onChange(paths))) {
      stopWatching();
    }
  });
}

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
async function confirmManifestUpdate(): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const answer = await inquirer.prompt([
    {
      default: false,
      message: 'Manifest file has been updated. Do you want to push and overwrite?',
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
  return answer.overwrite;
}
