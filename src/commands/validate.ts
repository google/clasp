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

// This module provides validatition functions for commandline options and arguments

import {InvalidOptionArgumentError} from 'commander';

/**
 * Validates if the value is an integer.
 * If the startInclusive and endInclusive parameters are provided, additional check against the bounds
 *
 * @returns {number} The valid integer value.
 * @throws {InvalidOptionArgumentError} If value is not an integer or out of bounds.
 */
export const validateOptionInt = (val: any, startInclusive?: number, endInclusive?: number): number => {
  let errorMsg = '';

  // Commander already handles the case where the option was provided with no argument
  if (val) {
    if (!Number.isInteger(Number(val))) {
      errorMsg = `'${val}' is not a valid integer.`;
    } else {
      if (startInclusive != null && endInclusive != null && (val < startInclusive || val > endInclusive)) {
        errorMsg = `'${val}' should be >= ${startInclusive} and <= ${endInclusive}.`;
      }
    }

    if (errorMsg) throw new InvalidOptionArgumentError(errorMsg);
  }
  return val;
};
