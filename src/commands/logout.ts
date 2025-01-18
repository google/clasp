import {logout} from '../auth.js';

/**
 * Logs out the user by deleting credentials.
 */
export async function logoutCommand(): Promise<void> {
  logout();
}
