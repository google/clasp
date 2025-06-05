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
 * @fileoverview Manages experimental features in clasp.
 * Experimental features can be enabled or disabled using environment variables.
 * The naming convention for environment variables is `CLASP_EXPERIMENT_NAME_IN_UPPERCASE=true`.
 */

/**
 * Checks if a specific experimental feature is enabled via an environment variable.
 *
 * The environment variable name is constructed by prefixing "CLASP_" and converting
 * the `experimentName` to uppercase (e.g., `experimentName = 'my_feature'` becomes
 * `CLASP_MY_FEATURE`).
 *
 * The feature is considered enabled if the environment variable is set to "true" (case-insensitive)
 * or "1".
 *
 * @param experimentName The name of the experimental feature (e.g., 'feature_x').
 * @param defaultValue The default value to return if the environment variable is not set. Defaults to `false`.
 * @returns `true` if the experimental feature is enabled, `false` otherwise.
 */
export function isEnabled(experimentName: string, defaultValue = false): boolean {
  const envVarName = `CLASP_${experimentName.toUpperCase()}`;
  const envVarValue = process.env[envVarName];

  if (envVarValue === undefined || envVarValue === null) {
    return defaultValue; // Environment variable not set, return default.
  }

  // Check for common truthy string values.
  const lowerCaseValue = envVarValue.toLowerCase();
  if (lowerCaseValue === 'true' || envVarValue === '1') {
    return true;
  }

  return false; // All other values (including "false", "0", empty string, etc.) are considered disabled.
}

/**
 * Experimental flag: If true, includes the `authUser` parameter (user hint)
 * in URLs opened by clasp (e.g., when opening a script or document).
 * This can help Google services select the correct user account if multiple
 * users are logged in.
 *
 * To enable, set the environment variable `CLASP_ENABLE_USER_HINTS=true`.
 */
export const INCLUDE_USER_HINT_IN_URL = isEnabled('enable_user_hints');
