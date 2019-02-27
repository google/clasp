import * as commander from 'commander';

/**
 * Outputs the help command.
 */
export default async () => {
  commander.outputHelp();
  process.exit(0);
};