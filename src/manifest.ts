import path from 'path';
import is from '@sindresorhus/is';
import fs from 'fs-extra';

import {PUBLIC_ADVANCED_SERVICES as publicAdvancedServices} from './apis.js';

export function loadManifest(contentDir: string): Manifest {
  return fs.readJsonSync(path.join(contentDir, 'appsscript.json'));
}

export function saveManifest(contentDir: string, manifest: Manifest) {
  fs.writeJsonSync(path.join(contentDir, 'appsscript.json'), manifest, {spaces: 2});
}

/**
 * Returns true if the manifest is valid.
 */
export function isValidManifest(manifest?: Manifest): manifest is Manifest {
  return !is.nullOrUndefined(manifest);
}

/**
 * Ensures the manifest is correct for running a function.
 * The manifest must include:
 * "executionApi": {
 *   "access": "MYSELF"
 * }
 */
export function isValidRunManifest(manifest?: Manifest): boolean {
  return isValidManifest(manifest) && manifest.executionApi !== undefined && manifest.executionApi.access !== undefined;
}

/**
 * Adds a list of scopes to the manifest.
 * @param {string[]} scopes The list of explicit scopes
 */
export async function addScopeToManifest(contentDir: string, scopes: readonly string[]) {
  const manifest = loadManifest(contentDir);
  manifest.oauthScopes = [...new Set([...(manifest.oauthScopes ?? []), ...scopes])];
  saveManifest(contentDir, manifest);
}

/**
 * Enables or disables an advanced service in the manifest.
 * @param serviceId {string} The id of the service that should be enabled or disabled.
 * @param enable {boolean} True if you want to enable a service. Disables otherwise.
 * @see PUBLIC_ADVANCED_SERVICES
 */
export async function enableOrDisableAdvanceServiceInManifest(contentDir: string, serviceId: string, enable: boolean) {
  const manifest = loadManifest(contentDir);

  // Create objects if they don't exist.
  if (!manifest.dependencies) {
    manifest.dependencies = {enabledAdvancedServices: []};
  }

  // Copy the list of advanced services:
  // Disable the service (even if we may enable it)
  const enabledServices = (manifest.dependencies.enabledAdvancedServices ?? []).filter(
    (service: Readonly<EnabledAdvancedService>) => service.serviceId !== serviceId,
  );

  // Enable the service
  if (enable) {
    // Add new service (get the first one from the public list)
    enabledServices.push(publicAdvancedServices.find(service => service.serviceId === serviceId)!);
  }

  // Overwrites the old list with the new list.
  manifest.dependencies.enabledAdvancedServices = enabledServices;

  saveManifest(contentDir, manifest);
}

export interface EnabledAdvancedService {
  userSymbol: string;
  serviceId: string;
  version: string;
}

export interface Library {
  userSymbol: string;
  libraryId: string;
  version: string;
  developmentMode: boolean;
}

export interface Dependencies {
  enabledAdvancedServices?: EnabledAdvancedService[];
  libraries?: Library[];
}

export interface Webapp {
  access: string;
  executeAs: string;
}

export interface ExecutionApi {
  access: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Unconditional {}

export interface ContextualTrigger {
  unconditional: Unconditional;
  onTriggerFunction: string;
}

export interface SelectAction {
  text: string;
  runFunction: string;
}

interface ComposeTrigger {
  selectActions: SelectAction[];
  draftAccess: string;
}

export interface UniversalAction {
  text: string;
  runFunction: string;
  openLink: string;
}

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

export interface Macro {
  menuName: string;
  functionName: string;
  defaultShortcut: string;
}

export interface Sheets {
  macros: Macro[];
}

export interface Gmail {
  oauthScopes: string[];
  urlFetchWhitelist: string[];
  gmail: Gmail2;
  sheets: Sheets;
}

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
