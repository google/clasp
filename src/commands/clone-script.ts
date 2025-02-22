import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, isInteractive, withSpinner} from './utils.js';

export const command = new Command('clone-script')
  .alias('clone')
  .description('Clone an existing script')
  .arguments('[scriptId] [versionNumber]')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  .action(async function (this: Command, scriptId: string, versionNumber: number | undefined) {
    let clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    if (clasp.project.exists()) {
      this.error('Project file already exists.');
    }

    const rootDir: string = this.opts().rootDir;

    clasp.withContentDir(rootDir ?? '.');

    if (scriptId) {
      const match = scriptId.match(/https:\/\/script\.google\.com\/d\/([^/]+)\/.*/);
      if (match) {
        scriptId = match[1];
      } else {
        scriptId = scriptId.trim();
      }
    } else if (isInteractive()) {
      const projects = await clasp.project.listScripts();
      const choices = projects.results.map(file => ({
        name: `${file.name.padEnd(20)} - https://script.google.com/d/${file.id}/edit`,
        value: file.id,
      }));
      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: LOG.CLONE_SCRIPT_QUESTION,
          name: 'scriptId',
          pageSize: 30,
          type: 'list',
        },
      ]);
      scriptId = answer.scriptId;
    }

    if (!scriptId) {
      this.error('No script ID.');
    }

    try {
      const files = await withSpinner('Cloning script...', async () => {
        clasp = clasp.withScriptId(scriptId);
        const files = await clasp.files.pull(versionNumber);
        clasp.project.updateSettings();
        return files;
      });
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      console.log(LOG.CLONE_SUCCESS(files.length));
    } catch (error) {
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        this.error('Invalid script ID.');
      }
      throw error;
    }
  });
