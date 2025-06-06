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

// This file provides functionality for managing experimental features in clasp
// through environment variables, allowing features to be toggled on or off.

export function isEnabled(experimentName: string, defaultValue = false) {
  const envVarName = `CLASP_${experimentName.toUpperCase()}`;
  const envVarValue = process.env[envVarName];

  if (envVarValue === undefined || envVarValue === null) {
    return defaultValue;
  }

  if (envVarValue.toLowerCase() === 'true' || envVarValue === '1') {
    return true;
  }

  return false;
}

export const INCLUDE_USER_HINT_IN_URL = isEnabled('enable_user_hints');
