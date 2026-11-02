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

// This file defines the `ChatApp` class, which manages Google Chat app
// configurations via the Google Workspace Add-ons API.

import fs from 'fs/promises';
import path from 'path';
import Debug from 'debug';

import {CHAT_APP_CONFIG_FILENAME, PROJECT_MANIFEST_FILENAME} from '../constants.js';
import type {Manifest} from './manifest.js';
import {ClaspOptions, assertAuthenticated, assertGcpProjectConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

const GSUITE_ADDONS_BASE_URL = 'https://gsuiteaddons.googleapis.com/v1';

export type ChatAppConfigView = 'CHAT_APP_CONFIG_VIEW_UNSPECIFIED' | 'BASIC' | 'FULL';
export type ChatAppState = 'APP_STATE_UNSPECIFIED' | 'ACTIVE' | 'DISABLED';
export type MarkupSyntax = 'MARKUP_SYNTAX_UNSPECIFIED' | 'MARKUP_SYNTAX_CHAT' | 'MARKUP_SYNTAX_MARKDOWN';
export type DialogflowEdition = 'DIALOGFLOW_EDITION_UNSPECIFIED' | 'ES' | 'CX';
export type AppCommandType = 'COMMAND_TYPE_UNSPECIFIED' | 'SLASH_COMMAND' | 'QUICK_COMMAND' | 'MESSAGE_ACTION';

export interface HttpPerEventEndpointConfig {
  appCommandEndpoint: string;
  addedToSpaceEndpoint: string;
  messageEndpoint: string;
  removedFromSpaceEndpoint: string;
  systemCommandEndpoint?: string;
}

export interface HttpEndpointConfig {
  commonUrl?: string;
  perEventEndpointConfig?: HttpPerEventEndpointConfig;
}

export interface AppsScriptPerEventEndpointConfig {
  appCommandEndpoint?: string;
  addedToSpaceEndpoint?: string;
  messageEndpoint?: string;
  removedFromSpaceEndpoint?: string;
  systemCommandEndpoint?: string;
}

export interface AppsScriptEndpointConfig {
  deploymentId: string;
  perEventEndpointConfig?: AppsScriptPerEventEndpointConfig;
}

export interface CloudPubSubEndpointConfig {
  topic: string;
}

export interface DialogflowEndpointConfig {
  dialogflowEdition: DialogflowEdition;
  agent?: string;
}

export interface ConnectionConfig {
  httpEndpointConfig?: HttpEndpointConfig;
  appsScriptEndpointConfig?: AppsScriptEndpointConfig;
  cloudPubSubEndpointConfig?: CloudPubSubEndpointConfig;
  dialogflowEndpointConfig?: DialogflowEndpointConfig;
}

export interface AppCommand {
  commandType: AppCommandType;
  commandId: number;
  command?: string;
  displayName?: string;
  description: string;
  dialogEnabled?: boolean;
  loadingNotificationMessage?: string;
}

export interface UrlPattern {
  hostPattern: string;
  pathPrefix?: string;
}

export interface InteractiveFeatureConfig {
  supportsMultiuserSpaces?: boolean;
  connectionConfig: ConnectionConfig;
  appCommands?: AppCommand[];
  urlPatterns?: UrlPattern[];
  allowlistedTestingPrincipals?: string[];
}

/**
 * Configuration of a Google Chat app built as a Google Workspace add-on.
 * @see https://developers.google.com/workspace/chat/configure-chat-api#configure-api
 */
export interface ChatAppConfig {
  name?: string;
  displayName?: string;
  avatarUri?: string;
  description?: string;
  state?: ChatAppState;
  interactiveFeatureConfig?: InteractiveFeatureConfig;
  errorLoggingEnabled?: boolean;
  markupSyntax?: MarkupSyntax;
  createTime?: string;
  updateTime?: string;
  etag?: string;
}

/**
 * Populates missing ChatAppConfig fields from appsscript.json addOns.common defaults.
 */
export function mergeManifestDefaults(
  chatAppConfig: Readonly<Partial<ChatAppConfig>>,
  manifest?: Readonly<Manifest>,
): Partial<ChatAppConfig> {
  const merged: Partial<ChatAppConfig> = {...chatAppConfig};
  const common = manifest?.addOns?.common;
  if (!merged.displayName && common?.name) {
    merged.displayName = common.name;
  }
  if (!merged.avatarUri && common?.logoUrl) {
    merged.avatarUri = common.logoUrl;
  }
  return merged;
}

/**
 * Prepares a ChatAppConfig object for UpdateChatAppConfig (PATCH),
 * stripping output-only fields and ensuring `name` is populated.
 */
export function prepareChatAppConfigPayload(
  projectId: string,
  chatAppConfig: Readonly<Partial<ChatAppConfig>>,
): Partial<ChatAppConfig> {
  const {createTime: _createTime, updateTime: _updateTime, etag: _etag, ...rest} = chatAppConfig;
  return {
    name: `projects/${projectId}/chatAppConfig`,
    ...rest,
  };
}

/**
 * Manages Google Chat app configuration via the Google Workspace Add-ons API.
 */
export class ChatApp {
  private options: ClaspOptions;

  constructor(config: ClaspOptions) {
    this.options = config;
  }

  /**
   * Resolves the path to the local Chat app configuration JSON file.
   */
  resolveConfigPath(customPath?: string): string {
    if (customPath) {
      return path.isAbsolute(customPath) ? customPath : path.resolve(this.options.files.projectRootDir, customPath);
    }
    return path.join(this.options.files.contentDir, CHAT_APP_CONFIG_FILENAME);
  }

  /**
   * Retrieves the Chat app configuration for the configured GCP project.
   */
  async getConfig(view: ChatAppConfigView = 'FULL'): Promise<ChatAppConfig | undefined> {
    debug('Fetching Chat app config with view %s', view);
    assertAuthenticated(this.options);
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    try {
      const response = await this.options.credentials.request<ChatAppConfig>({
        url: `${GSUITE_ADDONS_BASE_URL}/projects/${projectId}/chatAppConfig`,
        method: 'GET',
        params: {view},
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }

  /**
   * Fetches the Chat app configuration and writes it to `chatapp.json` (or `customPath`).
   */
  async pullConfig(
    customPath?: string,
    view: ChatAppConfigView = 'FULL',
  ): Promise<{config: ChatAppConfig; filePath: string}> {
    assertGcpProjectConfigured(this.options);
    const projectId = this.options.project.projectId;
    const remoteConfig = await this.getConfig(view);
    const cleanConfig = prepareChatAppConfigPayload(projectId, remoteConfig ?? {});
    const filePath = this.resolveConfigPath(customPath);
    await fs.writeFile(filePath, `${JSON.stringify(cleanConfig, null, 2)}\n`, 'utf8');
    return {config: cleanConfig, filePath};
  }

  /**
   * Reads `chatapp.json` (or `customPath`), merges `addOns.common` defaults from
   * `appsscript.json` if present, and updates the project's Chat app configuration.
   */
  async pushConfig(customPath?: string, updateMask?: string): Promise<ChatAppConfig | undefined> {
    debug('Updating Chat app config');
    assertAuthenticated(this.options);
    assertGcpProjectConfigured(this.options);

    const projectId = this.options.project.projectId;
    const filePath = this.resolveConfigPath(customPath);

    let rawContent: string;
    try {
      rawContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Chat app configuration file not found at ${filePath}.`, {cause: error});
    }

    let chatConfig: Partial<ChatAppConfig> = JSON.parse(rawContent) as Partial<ChatAppConfig>;

    const manifestPath = path.join(this.options.files.contentDir, PROJECT_MANIFEST_FILENAME);
    try {
      const manifestRaw = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestRaw) as Manifest;
      chatConfig = mergeManifestDefaults(chatConfig, manifest);
    } catch {
      // appsscript.json is optional when pushing chatapp.json
    }

    const payload = prepareChatAppConfigPayload(projectId, chatConfig);
    try {
      const response = await this.options.credentials.request<ChatAppConfig>({
        url: `${GSUITE_ADDONS_BASE_URL}/projects/${projectId}/chatAppConfig`,
        method: 'PATCH',
        params: updateMask ? {updateMask} : undefined,
        data: payload,
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
}
