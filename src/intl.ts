// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Initializes and exports an internationalization (i18n) instance
 * using `@formatjs/intl`. This setup allows for localized messages throughout
 * the clasp application. It determines the user's locale from environment
 * variables and loads the appropriate messages (currently placeholder).
 */

import {createIntl, createIntlCache} from '@formatjs/intl';
import Debug from 'debug';

const debug = Debug('clasp:intl');

/**
 * Type guard to filter out null and undefined values from an array.
 * @param item The item to check.
 * @returns True if the item is neither null nor undefined, false otherwise.
 * @template T The type of the item.
 */
function isDefined<T>(item: T): item is NonNullable<T> {
  return item !== null && item !== undefined;
}

/**
 * Determines the application's locale based on environment variables.
 * It checks `LC_ALL`, `LC_CTYPE`, and `LANG` in order.
 * If none are valid or set, it defaults to 'en' (English).
 * @returns The determined locale string (e.g., 'en-US', 'fr-FR').
 */
function getLocale(): string {
  // Environment variables commonly used to specify locale.
  const envLocaleVariables = [process.env.LC_ALL, process.env.LC_CTYPE, process.env.LANG];
  const validEnvLocales = envLocaleVariables.filter(isDefined);

  for (const envLocale of validEnvLocales) {
    try {
      // Normalize the locale string (e.g., "en_US.UTF-8" to "en-US").
      // The Intl.Locale constructor is robust in parsing various locale formats.
      const normalizedLocale = new Intl.Locale(envLocale.split('.')[0].replace('_', '-')).toString();
      debug('Detected locale: %s from environment variable', normalizedLocale);
      return normalizedLocale;
    } catch (error) {
      // Ignore errors from invalid locale strings and try the next environment variable.
      debug('Invalid locale string "%s" encountered from environment: %s', envLocale, error.message);
    }
  }
  debug('No valid locale found in environment variables. Defaulting to "en".');
  return 'en'; // Default locale if none found or all are invalid.
}

/**
 * Placeholder function for loading localized messages for a given locale.
 * Currently, this returns an empty object as localization (L10N) is not yet implemented.
 * @param _locale The locale for which to load messages (currently unused).
 * @returns An empty object, representing no loaded messages.
 * @todo Implement actual message loading for different locales when L10N is added.
 */
function loadMessages(_locale: string): Record<string, string> {
  // TODO - L10N (localization) is not implemented yet.
  // When implemented, this function would load message bundles (e.g., from JSON files)
  // based on the provided locale. For example:
  // try {
  //   return require(`./locales/${locale}.json`);
  // } catch {
  //   return {}; // Fallback to empty if locale file not found
  // }
  return {};
}

// Create a cache for the Intl object to improve performance.
const cache = createIntlCache();

// Determine the application's current locale and timezone.
const currentLocale = getLocale();
const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

debug('Using locale: "%s" and timezone: "%s" for internationalization.', currentLocale, systemTimeZone);

/**
 * The main internationalization (i18n) object used throughout clasp.
 * It is configured with the determined locale, system timezone, a default locale ('en'),
 * and a (currently empty) set of messages.
 * Use this object's methods (e.g., `intl.formatMessage(...)`) for all user-facing strings.
 */
export const intl = createIntl(
  {
    locale: currentLocale, // The application's current determined locale.
    timeZone: systemTimeZone, // Use the system's timezone for date/time formatting.
    defaultLocale: 'en', // Fallback locale if a message is not found in the currentLocale.
    messages: loadMessages(currentLocale), // Localized messages for the currentLocale.
  },
  cache, // Use the created cache for performance.
);
