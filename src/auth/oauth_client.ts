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

// Shared constants and helpers for identifying clasp OAuth clients.

export const DEFAULT_CLASP_OAUTH_CLIENT_ID =
  '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com';
export const DEFAULT_CLASP_OAUTH_CLIENT_SECRET = 'v6V3fKV_zWU7iw1DrpO1rknX';

export type OAuthClientType = 'google-provided' | 'user-provided';

export function getOAuthClientType(clientId?: string): OAuthClientType | undefined {
  if (!clientId) {
    return undefined;
  }
  return clientId === DEFAULT_CLASP_OAUTH_CLIENT_ID ? 'google-provided' : 'user-provided';
}
