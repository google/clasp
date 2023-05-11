import { ClaspError } from '../clasp-error.js';
import { ERROR } from '../messages.js';
/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default async (_, command) => {
    throw new ClaspError(ERROR.COMMAND_DNE(command.args.join(' ')));
};
//# sourceMappingURL=default.js.map