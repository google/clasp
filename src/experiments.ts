export function isEnabled(experimentName: string, defaultValue = false) {
  const envVarName = `CLASP_${experimentName.toUpperCase()}`;
  const envVarValue = process.env[envVarName];

  if (envVarValue === undefined || envVarValue === null) {
    return defaultValue;
  }

  if (envVarValue.toLowerCase() === 'true' || envVarValue === '1') {
    return true;
  }

  if (envVarValue.toLowerCase() === 'false' || envVarValue === '0') {
    return false;
  }

  // If it's not a boolean, return the raw string value (for string experiments)
  return envVarValue;
}

export const INCLUDE_USER_HINT_IN_URL = isEnabled('enable_user_hints');
