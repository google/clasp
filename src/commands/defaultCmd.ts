import { ERROR, logError } from '../utils';
import { Command } from 'commander';

/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default async (_: Command, command: string): Promise<void> => {
  logError(null, ERROR.COMMAND_DNE(command));
};
