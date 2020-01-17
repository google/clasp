import commander from 'commander';

/**
 * Outputs the help command.
 */
export default async (): Promise<void> => {
  commander.outputHelp();
};
