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
