import * as fs from 'fs';
import { PUBLIC_ADVANCED_SERVICES } from './apis';
import { DOT } from './dotfile';
import { ERROR, PROJECT_MANIFEST_FILENAME, getProjectSettings, logError } from './utils';
const path = require('path');

/**
 * Checks if the rootDir appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
export const manifestExists = (rootDir: string = DOT.PROJECT.DIR): boolean =>
  fs.existsSync(path.join(rootDir, PROJECT_MANIFEST_FILENAME));

/**
 * Reads the appsscript.json manifest file.
 * @returns {Promise} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export async function readManifest(): Promise<Manifest> {
  let { rootDir } = await getProjectSettings();
  if (typeof rootDir === 'undefined') rootDir = DOT.PROJECT.DIR;
  const manifest = path.join(rootDir, PROJECT_MANIFEST_FILENAME);
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8'));
  } catch (err) {
    logError(null, ERROR.NO_MANIFEST(manifest));
    throw Error('Could not read the manifest file.'); // TODO standardize errors.
  }
}

/**
 * Writes the appsscript.json manifest file.
 * @param {Manifest} manifest The new manifest to write.
 */
export async function writeManifest(manifest: Manifest) {
  let { rootDir } = await getProjectSettings();
  if (typeof rootDir === 'undefined') rootDir = DOT.PROJECT.DIR;
  const manifestFilePath = path.join(rootDir, PROJECT_MANIFEST_FILENAME);
  try {
    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2));
  } catch (err) {
    logError(null, ERROR.FS_FILE_WRITE);
  }
}

/**
 * Enables or disables a advanced service in the manifest.
 * @param serviceId {string} The id of the service that should be enabled or disabled.
 * @param enable {boolean} True if you want to enable a service. Disables otherwise.
 * @see PUBLIC_ADVANCED_SERVICES
 */
export async function enableOrDisableAdvanceServiceInManifest(serviceId: string, enable: boolean) {
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
  if (!manifest.dependencies) manifest.dependencies = {};
  if (manifest.dependencies && !manifest.dependencies.enabledAdvancedServices) {
    manifest.dependencies.enabledAdvancedServices = [];
  }
  // Copy the list of advanced services:
  let newEnabledAdvancedServices: EnabledAdvancedService[] =
      manifest.dependencies.enabledAdvancedServices || [];

  // Disable the service (even if we may enable it)
  newEnabledAdvancedServices = manifest.dependencies.enabledAdvancedServices || [];
  newEnabledAdvancedServices = newEnabledAdvancedServices.filter(
    (service) => service.serviceId !== serviceId);

  // Enable the service
  if (enable) {
    // Add new service (get the first one from the public list)
    const newAdvancedService = PUBLIC_ADVANCED_SERVICES.filter(
      (service) => service.serviceId === serviceId)[0];
    newEnabledAdvancedServices.push(newAdvancedService);
  }

  // Overwrites the old list with the new list.
  manifest.dependencies.enabledAdvancedServices = newEnabledAdvancedServices;
  await writeManifest(manifest);
}

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

interface Unconditional {
}

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