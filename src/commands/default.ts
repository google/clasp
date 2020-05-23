/* eslint-disable new-cap */
import {Command} from 'commander';
import {ReadonlyDeep} from 'type-fest';

import {ERROR} from '../messages';
import {logError} from '../utils';

/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default async (_: ReadonlyDeep<Command>, command: string): Promise<void> => {
  logError(ERROR.COMMAND_DNE(command));
};
