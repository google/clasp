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

debug('Using locale: %s', locale);

export const intl = createIntl(
  {
    // Locale of the application
    locale,
    defaultLocale: 'en',
    messages: loadMessages(locale),
  },
  cache,
);
