import {ClaspError} from '../clasp-error.js';
import {ERROR} from '../messages.js';

import type {Command} from 'commander';
import type {ReadonlyDeep} from 'type-fest';

/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default async (_: object, command: ReadonlyDeep<Command>): Promise<void> => {
  throw new ClaspError(ERROR.COMMAND_DNE(command.args.join(' ')));
};
