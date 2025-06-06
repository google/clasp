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
