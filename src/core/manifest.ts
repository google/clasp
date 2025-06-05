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
 * @fileoverview TypeScript interfaces representing the structure of an Apps Script
 * project manifest file (appsscript.json).
 * For detailed information on the manifest structure and fields, refer to:
 * https://developers.google.com/apps-script/concepts/manifests
 */

/**
 * Represents an enabled Google Advanced Service in the manifest.
 */
export interface EnabledAdvancedService {
  /** The symbol used to access the service in Apps Script (e.g., `Drive`, `Gmail`). */
  userSymbol: string;
  /** The identifier of the service (e.g., `drive`, `gmail`). */
  serviceId: string;
  /** The version of the service to be used (e.g., `v3`, `v1`). */
  version: string;
}

/**
 * Represents a library dependency in the manifest.
 */
export interface Library {
  /** The symbol used to access the library in Apps Script. */
  userSymbol: string;
  /** The script ID of the library. */
  libraryId: string;
  /** The version of the library to use. */
  version: string;
  /** If true, uses the library's development mode (latest code). */
  developmentMode: boolean;
}

/**
 * Groups advanced service and library dependencies.
 */
export interface Dependencies {
  /** A list of enabled advanced Google services. */
  enabledAdvancedServices?: EnabledAdvancedService[];
  /** A list of library dependencies. */
  libraries?: Library[];
}

/**
 * Configuration for a web app deployment.
 */
export interface Webapp {
  /** Who has permission to access the web app ('MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS'). */
  access: string;
  /** How the script executes ('USER_ACCESSING', 'USER_DEPLOYING'). */
  executeAs: string;
}

/**
 * Configuration for the Apps Script API executable.
 */
export interface ExecutionApi {
  /** Who has permission to execute the script via the API ('MYSELF', 'DOMAIN'). */
  access: string;
}

/**
 * Represents an unconditional trigger for a Google Workspace Add-on.
 * This interface is typically empty as per the manifest structure.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Unconditional {}

/**
 * Defines a contextual trigger for a Google Workspace Add-on.
 */
export interface ContextualTrigger {
  /** The unconditional trigger part, usually empty. */
  unconditional: Unconditional;
  /** The function to run when the trigger fires. */
  onTriggerFunction: string;
}

/**
 * Defines a select action for a Google Workspace Add-on, typically in a compose trigger.
 */
export interface SelectAction {
  /** The text displayed for the action. */
  text: string;
  /** The function to run when the action is selected. */
  runFunction: string;
}

/**
 * Configuration for a compose trigger in a Gmail add-on.
 */
interface ComposeTrigger {
  /** List of select actions available in the compose UI. */
  selectActions: SelectAction[];
  /** Defines access to draft metadata ('NONE', 'METADATA'). */
  draftAccess: string;
}

/**
 * Defines a universal action for a Google Workspace Add-on.
 */
export interface UniversalAction {
  /** The text displayed for the action. */
  text: string;
  /** The function to run when the action is selected. */
  runFunction?: string; // Optional, as openLink can be used instead
  /** A URL to open when the action is selected. */
  openLink?: string; // Optional, as runFunction can be used instead
}

/**
 * Specific configuration for a Gmail add-on. (Renamed from `Gmail2` for clarity to `GmailAddonSpecifics`)
 */
export interface GmailAddonSpecifics { // Renamed from Gmail2
  /** The name of the Gmail add-on. */
  name: string;
  /** URL for the add-on's logo. */
  logoUrl: string;
  /** Primary color for the add-on's branding. */
  primaryColor: string;
  /** Secondary color for the add-on's branding. */
  secondaryColor: string;
  /** Name of the function to check for authorization. */
  authorizationCheckFunction: string;
  /** List of contextual triggers. */
  contextualTriggers?: ContextualTrigger[];
  /** Configuration for compose triggers. */
  composeTrigger?: ComposeTrigger;
  /** URL prefixes that the add-on is allowed to open. */
  openLinkUrlPrefixes?: string[];
  /** List of universal actions. */
  universalActions?: UniversalAction[];
  /** Whether the add-on should use the locale of the Gmail app. */
  useLocaleFromApp?: boolean;
}

/**
 * Defines a macro for Google Sheets.
 */
export interface Macro {
  /** The name of the macro as it appears in the Sheets UI. */
  menuName: string;
  /** The function to run when the macro is executed. */
  functionName: string;
  /** The default keyboard shortcut for the macro. */
  defaultShortcut: string;
}

/**
 * Specific configuration for Google Sheets add-ons or macros.
 */
export interface Sheets {
  /** A list of macros defined for Sheets. */
  macros?: Macro[];
}

/**
 * Top-level configuration for a Google Workspace Add-on, particularly for Gmail.
 */
export interface GmailAddon { // Renamed from Gmail
  /** OAuth scopes required by the add-on. */
  oauthScopes?: string[];
  /** Whitelisted URLs for `UrlFetchApp`. */
  urlFetchWhitelist?: string[];
  /** Specific Gmail add-on configurations. */
  gmail?: GmailAddonSpecifics; // Changed from Gmail2 to GmailAddonSpecifics
  /** Specific Sheets add-on configurations. */
  sheets?: Sheets;
}

/**
 * Represents the complete structure of an `appsscript.json` manifest file.
 */
export interface Manifest {
  /** The timezone for the script project. */
  timeZone?: string;
  /** OAuth scopes required by the script project. */
  oauthScopes?: string[];
  /** Dependencies such as libraries and advanced services. */
  dependencies?: Dependencies;
  /** The logging level for script execution exceptions ('NONE', 'STACKDRIVER'). */
  exceptionLogging?: string;
  /** Configuration for web app deployments. */
  webapp?: Webapp;
  /** Configuration for the Apps Script API. */
  executionApi?: ExecutionApi;
  /** Whitelisted URLs for `UrlFetchApp`. */
  urlFetchWhitelist?: string[];
  /** Configuration for Google Workspace Add-ons (specifically Gmail context here). */
  gmail?: GmailAddon; // Changed from Gmail to GmailAddon
}
