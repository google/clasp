import type { Command } from 'commander';
import type { ReadonlyDeep } from 'type-fest';
declare const _default: (_: unknown, command: ReadonlyDeep<Command>) => Promise<void>;
/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export default _default;
