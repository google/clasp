import { ERROR, logError } from '../utils';

/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default async (command: string) => {
  logError(null, ERROR.COMMAND_DNE(command));
};
