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

import {createIntl, createIntlCache} from '@formatjs/intl';
import Debug from 'debug';

const debug = Debug('clasp:intl');

function isDefined<T>(item: T): item is NonNullable<T> {
  return item !== null && item !== undefined;
}

function getLocale() {
  const envLocales = [process.env.LC_ALL, process.env.LC_CTYPE, process.env.LANG].filter(isDefined);

  for (const envLocale of envLocales) {
    try {
      // Attempt to normalize the locale string (e.g., "en_US" to "en-US")
      const normalizedLocale = new Intl.Locale(envLocale).toString();
      return normalizedLocale;
    } catch (_error) {
      // Ignore invalid locale strings and try the next one
      debug('Invalid locale string: %s', envLocale);
    }
  }
  return 'en';
}

function loadMessages(_locale: string) {
  // TODO - L10N not implemented yet.
  return {};
}

const cache = createIntlCache();
const locale = getLocale();
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

debug('Using locale: %s', locale);

export const intl = createIntl(
  {
    // Locale of the application
    locale,
    timeZone: localTimeZone,
    defaultLocale: 'en',
    messages: loadMessages(locale),
  },
  cache,
);
