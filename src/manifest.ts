import path from 'path';
import is from '@sindresorhus/is';
import fs from 'fs-extra';

import {PUBLIC_ADVANCED_SERVICES as publicAdvancedServices} from './apis.js';
import {ClaspError} from './clasp-error.js';
import {Conf} from './conf.js';
import {FS_OPTIONS, PROJECT_MANIFEST_FILENAME} from './constants.js';
import {ProjectSettings} from './dotfile.js';
import {ERROR} from './messages.js';
import {getProjectSettings, parseJsonOrDie} from './utils.js';

const config = Conf.get();

/** Gets the path to manifest for given `rootDir` */
const getManifestPath = (rootDir: string): string => path.join(rootDir, PROJECT_MANIFEST_FILENAME);

/** Gets the `rootDir` from given project */
const getRootDir = ({rootDir}: ProjectSettings): string =>
  is.string(rootDir) ? rootDir : config.projectRootDirectory!;

/**
 * Checks if the rootDir appears to be a valid project.
 *
 * @param {string} rootDir dir to check.
 *
 * @return {boolean} True if valid project, false otherwise
 */
export const manifestExists = (rootDir = config.projectRootDirectory): boolean =>
  rootDir !== undefined && fs.existsSync(getManifestPath(rootDir));

/**
 * Reads the appsscript.json manifest file.
 * @returns {Promise<Manifest>} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export const readManifest = async (): Promise<Manifest> => {
  const manifest = getManifestPath(getRootDir(await getProjectSettings()));
  try {
    return fs.readJsonSync(manifest, FS_OPTIONS) as Manifest;
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(ERROR.NO_MANIFEST(manifest));
  }
};

/**
 * Writes the appsscript.json manifest file.
 * @param {Manifest} manifest The new manifest to write.
 */
const writeManifest = async (manifest: Readonly<Manifest>) => {
  try {
    fs.writeJsonSync(getManifestPath(getRootDir(await getProjectSettings())), manifest, {encoding: 'utf8', spaces: 2});
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(ERROR.FS_FILE_WRITE);
  }
};

/**
 * Returns true if the manifest is valid.
 */
export const isValidManifest = async (manifest?: Manifest): Promise<boolean> =>
  !is.nullOrUndefined(manifest ?? (await getManifest()));

/**
 * Ensures the manifest is correct for running a function.
 * The manifest must include:
 * "executionApi": {
 *   "access": "MYSELF"
 * }
 */
export const isValidRunManifest = async (): Promise<boolean> => {
  const value = await getManifest();
  return Boolean((await isValidManifest(value)) && value.executionApi && value.executionApi.access);
};

/**
 * Reads manifest file from project root dir.
 * The manifest is valid if it:
 * - It exists in the project root.
 * - Is valid JSON.
 */
export const getManifest = async (): Promise<Manifest> =>
  parseJsonOrDie<Manifest>(fs.readFileSync(getManifestPath(getRootDir(await getProjectSettings())), FS_OPTIONS));

/**
 * Adds a list of scopes to the manifest.
 * @param {string[]} scopes The list of explicit scopes
 */
export const addScopeToManifest = async (scopes: readonly string[]) => {
  const manifest = await readManifest();
  manifest.oauthScopes = [...new Set([...(manifest.oauthScopes ?? []), ...scopes])];
  await writeManifest(manifest);
};

// /**
//  * Enables the Execution API in the Manifest.
//  * The Execution API requires the manifest to have the "executionApi.access" field set.
//  */
// // TODO: currently unused. Check relevancy
// export async function enableExecutionAPI() {
//   console.log('Writing manifest');
//   const manifest = await readManifest();
//   manifest.executionApi = manifest.executionApi ?? {
//     access: 'ANYONE',
//   };
//   await writeManifest(manifest);
//   console.log('Wrote manifest');

//   console.log('Checking Apps Script API');
//   if (!(await isEnabled('script'))) {
//     console.log('Apps Script API is currently disabled. Enabling…');
//     await enableOrDisableAPI('script', true);
//   }

//   console.log('Apps Script API is enabled.');
// }

/**
 * Enables or disables an advanced service in the manifest.
 * @param serviceId {string} The id of the service that should be enabled or disabled.
 * @param enable {boolean} True if you want to enable a service. Disables otherwise.
 * @see PUBLIC_ADVANCED_SERVICES
 */
export const enableOrDisableAdvanceServiceInManifest = async (serviceId: string, enable: boolean) => {
  /**
   * "enabledAdvancedServices": [
   *   {
   *     "userSymbol": "string",
   *     "serviceId": "string",
   *     "version": "string",
   *   }
   *   ...
   * ],
   */
  const manifest = await readManifest();
  // Create objects if they don't exist.
  if (!manifest.dependencies) {
    manifest.dependencies = {enabledAdvancedServices: []};
  }

  // Copy the list of advanced services:
  // Disable the service (even if we may enable it)
  const enabledServices = (manifest.dependencies.enabledAdvancedServices ?? []).filter(
    (service: Readonly<EnabledAdvancedService>) => service.serviceId !== serviceId
  );

  // Enable the service
  if (enable) {
    // Add new service (get the first one from the public list)
    enabledServices.push(publicAdvancedServices.find(service => service.serviceId === serviceId)!);
  }

  // Overwrites the old list with the new list.
  manifest.dependencies.enabledAdvancedServices = enabledServices;
  await writeManifest(manifest);
};

// Manifest Generator
// Generated with:
// - https://developers.google.com/apps-script/concepts/manifests
// - http://json2ts.com/

/*
{
  "timeZone": "df",
  "oauthScopes": [
    "df"
  ],
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "string",
        "serviceId": "string",
        "version": "string",
      }
    ],
    "libraries": [
      {
        "userSymbol": "string",
        "libraryId": "string",
        "version": "string",
        "developmentMode": true,
      }
    ]
  },
  "exceptionLogging": "string",
  "webapp": {
    "access": "string",
    "executeAs": "string",
  },
  "executionApi": {
    "access": "string",
  },
  "urlFetchWhitelist": [
    "string"
  ],
  "gmail": {
    "oauthScopes": [
      "https://www.googleapis.com/auth/gmail.addons.execute",
      "https://www.googleapis.com/auth/gmail.addons.current.message.metadata",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/script.locale"
    ],
    "urlFetchWhitelist": [
      "https://www.example.com/myendpoint/"
    ],
    "gmail": {
      "name": "My Gmail Add-on",
      "logoUrl": "https://www.example.com/hosted/images/2x/my-icon.png",
      "primaryColor": "#4285F4",
      "secondaryColor": "#00BCD4",
      "authorizationCheckFunction": "get3PAuthorizationUrls",
      "contextualTriggers": [
        {
          "unconditional": {},
          "onTriggerFunction": "buildAddOn"
        }
      ],
      "composeTrigger": {
        "selectActions": [
          {
            "text": "Add images to email",
            "runFunction": "getInsertImageComposeCards"
          }
        ],
        "draftAccess": "METADATA"
      },
      "openLinkUrlPrefixes": [
        "https://mail.google.com/",
        "https://script.google.com/a/google.com/d/",
        "https://drive.google.com/a/google.com/file/d/",
        "https://en.wikipedia.org/wiki/",
        "https://www.example.com/",
      ],
      "universalActions": [
        {
          "text": "Open settings",
          "runFunction": "getSettingsCard"
        },
        {
          "text": "Open help page",
          "openLink": "https://www.example.com/help"
        }
      ],
      "useLocaleFromApp": true
    },
    "sheets": {
      "macros": [
        {
          "menuName": "QuickRowSum",
          "functionName": "calculateRowSum",
          "defaultShortcut": "Ctrl+Alt+Shift+1"
        },
        {
          "menuName": "Headerfy",
          "functionName": "updateToHeaderStyle",
          "defaultShortcut": "Ctrl+Alt+Shift+2"
        }
      ]
    }
  }
}
*/

interface EnabledAdvancedService {
  userSymbol: string;
  serviceId: string;
  version: string;
}

interface Library {
  userSymbol: string;
  libraryId: string;
  version: string;
  developmentMode: boolean;
}

interface Dependencies {
  enabledAdvancedServices?: EnabledAdvancedService[];
  libraries?: Library[];
}

interface Webapp {
  access: string;
  executeAs: string;
}

interface ExecutionApi {
  access: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Unconditional {}

interface ContextualTrigger {
  unconditional: Unconditional;
  onTriggerFunction: string;
}

interface SelectAction {
  text: string;
  runFunction: string;
}

interface ComposeTrigger {
  selectActions: SelectAction[];
  draftAccess: string;
}

interface UniversalAction {
  text: string;
  runFunction: string;
  openLink: string;
}

interface Gmail2 {
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  authorizationCheckFunction: string;
  contextualTriggers: ContextualTrigger[];
  composeTrigger: ComposeTrigger;
  openLinkUrlPrefixes: string[];
  universalActions: UniversalAction[];
  useLocaleFromApp: boolean;
}

interface Macro {
  menuName: string;
  functionName: string;
  defaultShortcut: string;
}

interface Sheets {
  macros: Macro[];
}

interface Gmail {
  oauthScopes: string[];
  urlFetchWhitelist: string[];
  gmail: Gmail2;
  sheets: Sheets;
}

interface Manifest {
  timeZone?: string;
  oauthScopes?: string[];
  dependencies?: Dependencies;
  exceptionLogging?: string;
  webapp?: Webapp;
  executionApi?: ExecutionApi;
  urlFetchWhitelist?: string[];
  gmail?: Gmail;
}
