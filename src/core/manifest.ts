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

// This file defines TypeScript interfaces that represent the structure and
// properties of the Google Apps Script project manifest file (appsscript.json).

/**
 * Represents an enabled Google Advanced Service in the manifest.
 * @property {string} userSymbol - The variable name used to access the service in script.
 * @property {string} serviceId - The unique ID of the advanced service.
 * @property {string} version - The version of the advanced service.
 */
export interface EnabledAdvancedService {
  userSymbol: string;
  serviceId: string;
  version: string;
}

/**
 * Represents a library dependency in the manifest.
 * @property {string} userSymbol - The variable name used to access the library in script.
 * @property {string} libraryId - The script ID of the library.
 * @property {string} version - The version number or label of the library.
 * @property {boolean} developmentMode - Whether to use the library's development mode (HEAD).
 */
export interface Library {
  userSymbol: string;
  libraryId: string;
  version: string;
  developmentMode: boolean;
}

/**
 * Represents project dependencies, such as libraries and advanced services.
 * @property {EnabledAdvancedService[]} [enabledAdvancedServices] - A list of enabled advanced services.
 * @property {Library[]} [libraries] - A list of library dependencies.
 */
export interface Dependencies {
  enabledAdvancedServices?: EnabledAdvancedService[];
  libraries?: Library[];
}

/**
 * Configures a script project to act as a web app.
 * @property {string} access - Who has permission to run the web app (e.g., "MYSELF", "DOMAIN", "ANYONE", "ANYONE_ANONYMOUS").
 * @property {string} executeAs - How the script executes ("USER_ACCESSING" or "USER_DEPLOYING").
 */
export interface Webapp {
  access: string;
  executeAs: string;
}

/**
 * Configures a script project for API execution.
 * @property {string} access - Who has permission to run the API (e.g., "MYSELF", "DOMAIN", "ANYONE").
 */
export interface ExecutionApi {
  access: string;
}

/**
 * Represents an unconditional trigger for a contextual add-on.
 * This is typically an empty object.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Unconditional {}

/**
 * Defines a trigger for a contextual add-on.
 * @property {Unconditional} unconditional - Typically an empty object, indicating the trigger is always active in context.
 * @property {string} onTriggerFunction - The name of the function to call when the trigger fires.
 */
export interface ContextualTrigger {
  unconditional: Unconditional;
  onTriggerFunction: string;
}

/**
 * Defines a select action for a compose trigger in a Gmail add-on.
 * @property {string} text - The text displayed for this action.
 * @property {string} runFunction - The function to run when this action is selected.
 */
export interface SelectAction {
  text: string;
  runFunction: string;
}

/**
 * Defines a compose trigger for a Gmail add-on.
 * @property {SelectAction[]} selectActions - A list of actions available when composing a message.
 * @property {string} draftAccess - Specifies the level of access to draft metadata ("METADATA" or "NONE").
 */
interface ComposeTrigger {
  selectActions: SelectAction[];
  draftAccess: string;
}

/**
 * Defines a universal action for an add-on.
 * @property {string} text - The text displayed for this universal action.
 * @property {string} [runFunction] - The function to run when this action is selected (alternative to openLink).
 * @property {string} [openLink] - The URL to open when this action is selected (alternative to runFunction).
 */
export interface UniversalAction {
  text: string;
  runFunction: string;
  openLink: string;
}

/**
 * Specific configuration for a Gmail add-on.
 * @property {string} name - The name of the add-on.
 * @property {string} logoUrl - URL for the add-on's logo.
 * @property {string} [primaryColor] - Primary color for the add-on branding.
 * @property {string} [secondaryColor] - Secondary color for the add-on branding.
 * @property {string} [authorizationCheckFunction] - Name of a function to check authorization.
 * @property {ContextualTrigger[]} [contextualTriggers] - Triggers that activate based on Gmail content.
 * @property {ComposeTrigger} [composeTrigger] - Trigger that activates when composing a message.
 * @property {string[]} [openLinkUrlPrefixes] - URL prefixes that the add-on is allowed to open.
 * @property {UniversalAction[]} [universalActions] - Actions available globally within the add-on.
 * @property {boolean} [useLocaleFromApp] - Whether to use the locale from the host application (Gmail).
 */
export interface Gmail2 {
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

/**
 * Defines a macro for Google Sheets.
 * @property {string} menuName - The name of the macro as it appears in the Sheets menu.
 * @property {string} functionName - The name of the Apps Script function to execute.
 * @property {string} [defaultShortcut] - The default keyboard shortcut for the macro.
 */
export interface Macro {
  menuName: string;
  functionName: string;
  defaultShortcut: string;
}

/**
 * Configuration for Google Sheets specific features, like macros.
 * @property {Macro[]} [macros] - A list of macros defined for Sheets.
 */
export interface Sheets {
  macros: Macro[];
}

/**
 * Top-level configuration for a Gmail add-on within the manifest.
 * @property {string[]} [oauthScopes] - OAuth scopes required by the Gmail add-on.
 * @property {string[]} [urlFetchWhitelist] - URL patterns the add-on is allowed to fetch.
 * @property {Gmail2} [gmail] - Detailed configuration for the Gmail add-on.
 * @property {Sheets} [sheets] - Configuration for Sheets-specific features if the add-on extends Sheets.
 */
export interface Gmail {
  oauthScopes: string[];
  urlFetchWhitelist: string[];
  gmail: Gmail2;
  sheets: Sheets;
}

/**
 * Represents the structure of the `appsscript.json` manifest file.
 * @property {string} [timeZone] - The script's time zone (e.g., "America/New_York").
 * @property {string[]} [oauthScopes] - A list of OAuth scopes required by the script.
 * @property {Dependencies} [dependencies] - Project dependencies like libraries and advanced services.
 * @property {string} [exceptionLogging] - Configures exception logging (e.g., "STACKDRIVER").
 * @property {Webapp} [webapp] - Configuration for deploying the script as a web app.
 * @property {ExecutionApi} [executionApi] - Configuration for deploying the script as an API executable.
 * @property {string[]} [urlFetchWhitelist] - URL patterns the script is allowed to fetch.
 * @property {Gmail} [gmail] - Configuration for a Gmail add-on.
 */
export interface Manifest {
  timeZone?: string;
  oauthScopes?: string[];
  dependencies?: Dependencies;
  exceptionLogging?: string;
  webapp?: Webapp;
  executionApi?: ExecutionApi;
  urlFetchWhitelist?: string[];
  gmail?: Gmail;
}
