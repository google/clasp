import {Command} from 'commander';
import inquirer from 'inquirer';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

export const command = new Command('clone-script')
  .alias('clone')
  .description('Clone an existing script')
  .arguments('[scriptId] [versionNumber]')
  .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
  .action(async function (this: Command, scriptId: string, versionNumber: number | undefined) {
    let clasp: Clasp = this.opts().clasp;

    if (clasp.project.exists()) {
      const msg = intl.formatMessage({
        defaultMessage: 'Project file already exists.',
      });
      this.error(msg);
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
      const prompt = intl.formatMessage({defaultMessage: 'Clone which script?'});
      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: prompt,
          name: 'scriptId',
          pageSize: 30,
          type: 'list',
        },
      ]);
      scriptId = answer.scriptId;
    }

    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'No script ID.',
      });
      this.error(msg);
    }

    try {
      const cloningScriptMsg = intl.formatMessage({
        defaultMessage: 'Cloning script...',
      });
      const files = await withSpinner(cloningScriptMsg, async () => {
        clasp = clasp.withScriptId(scriptId);
        const files = await clasp.files.pull(versionNumber);
        clasp.project.updateSettings();
        return files;
      });
      files.forEach(f => console.log(`└─ ${f.localPath}`));
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Warning: files in subfolder are not accounted for unless you set a .claspignore file.
        Cloned {count, plural, 
          =0 {no files.}
          one {one file.}
          other {# files}}.`,
        },
        {
          count: files.length,
        },
      );
      console.log(successMessage);
    } catch (error) {
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        const msg = intl.formatMessage({
          defaultMessage: 'Invalid script ID.',
        });
        this.error(msg);
      }
      throw error;
    }
  });
