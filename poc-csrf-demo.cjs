/**
 * poc-csrf-demo.cjs — safe regression checker for OAuth CSRF state validation.
 *
 * Exercises the auth flow callback logic with mocked HTTP requests to verify
 * that missing or mismatched state parameters are correctly rejected.
 *
 * Usage (from the clasp repo root):
 *   npm run compile && node poc-csrf-demo.cjs
 *
 * Against the original (unpatched) source, reject cases will FAIL.
 * Against the patched source, all 6 cases should PASS.
 */

'use strict';

const http = require('http');

const results = [];
let exitCode = 0;

function log(status, label, detail) {
  const tag = status === 'PASS' ? 'PASS' : 'FAIL';
  if (tag === 'FAIL') exitCode = 1;
  console.log(`${tag} ${label}: ${detail}`);
  results.push({tag, label, detail});
}

function sendRequest(port, query) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${query}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({status: res.statusCode, body}));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function testLocalhostNoState(LocalServerAuthorizationCodeFlow, OAuth2Client) {
  const client = new OAuth2Client({
    clientId: 'test-id', clientSecret: 'test-secret', redirectUri: 'http://localhost',
  });
  const flow = new LocalServerAuthorizationCodeFlow(client, 0);
  const redirectUri = await flow.getRedirectUri();
  const port = new URL(redirectUri).port;
  const expectedState = 'correct_state_value';

  // Start listening but swallow the open() call side effects
  const codePromise = flow.promptAndReturnCode(
    `https://accounts.google.com/o/oauth2/v2/auth?state=${expectedState}`,
    expectedState,
  ).catch(() => null); // swallow expected rejection

  // Small delay for server to bind
  await new Promise(r => setTimeout(r, 50));

  try {
    const resp = await sendRequest(port, '?code=attacker_code');
    await codePromise;
    if (resp.status === 400) {
      log('PASS', 'local callback without state', 'expected reject, observed reject (HTTP 400)');
    } else {
      log('FAIL', 'local callback without state',
        `expected reject, observed accept; status=${resp.status}`);
    }
  } catch (_err) {
    log('PASS', 'local callback without state', 'expected reject, connection rejected');
  }
}

async function testLocalhostWrongState(LocalServerAuthorizationCodeFlow, OAuth2Client) {
  const client = new OAuth2Client({
    clientId: 'test-id', clientSecret: 'test-secret', redirectUri: 'http://localhost',
  });
  const flow = new LocalServerAuthorizationCodeFlow(client, 0);
  const redirectUri = await flow.getRedirectUri();
  const port = new URL(redirectUri).port;
  const expectedState = 'correct_state_value';

  const codePromise = flow.promptAndReturnCode(
    `https://accounts.google.com/o/oauth2/v2/auth?state=${expectedState}`,
    expectedState,
  ).catch(() => null);

  await new Promise(r => setTimeout(r, 50));

  try {
    const resp = await sendRequest(port, '?code=attacker_code&state=wrong_state');
    await codePromise;
    if (resp.status === 400) {
      log('PASS', 'local callback with mismatched state', 'expected reject, observed reject (HTTP 400)');
    } else {
      log('FAIL', 'local callback with mismatched state',
        `expected reject, observed accept; status=${resp.status}`);
    }
  } catch (_err) {
    log('PASS', 'local callback with mismatched state', 'expected reject, connection rejected');
  }
}

async function testLocalhostCorrectState(LocalServerAuthorizationCodeFlow, OAuth2Client) {
  const client = new OAuth2Client({
    clientId: 'test-id', clientSecret: 'test-secret', redirectUri: 'http://localhost',
  });
  const flow = new LocalServerAuthorizationCodeFlow(client, 0);
  const redirectUri = await flow.getRedirectUri();
  const port = new URL(redirectUri).port;
  const expectedState = 'correct_state_value';

  const codePromise = flow.promptAndReturnCode(
    `https://accounts.google.com/o/oauth2/v2/auth?state=${expectedState}`,
    expectedState,
  );

  await new Promise(r => setTimeout(r, 50));

  try {
    const resp = await sendRequest(port, `?code=legit_code&state=${expectedState}`);
    const code = await codePromise;
    if (code === 'legit_code' && resp.status === 200) {
      log('PASS', 'local callback with matching state', 'expected accept, observed accept');
    } else {
      log('FAIL', 'local callback with matching state', `unexpected status=${resp.status}`);
    }
  } catch (err) {
    log('FAIL', 'local callback with matching state', `expected accept, observed reject: ${err.message}`);
  }
}

async function testServerlessCallbacks() {
  console.log('\n=== Serverless (paste URL) flow ===\n');

  let parseAuthResponseUrl;
  try {
    const mod = await import('./build/src/auth/auth_code_flow.js');
    parseAuthResponseUrl = mod.parseAuthResponseUrl;
  } catch (err) {
    console.error('Could not import auth_code_flow. Run "npm run compile" first.');
    process.exit(2);
  }

  const expectedState = 'correct_state_value';

  // Test 4: pasted URL without state
  {
    const {code, state} = parseAuthResponseUrl('http://localhost:8888?code=attacker_code');
    if (!state || state !== expectedState) {
      log('PASS', 'serverless pasted URL without state', 'expected reject, observed reject');
    } else {
      log('FAIL', 'serverless pasted URL without state',
        `expected reject, observed accept; code="${code}"`);
    }
  }

  // Test 5: pasted URL with wrong state
  {
    const {code, state} = parseAuthResponseUrl(
      'http://localhost:8888?code=attacker_code&state=wrong_state',
    );
    if (!state || state !== expectedState) {
      log('PASS', 'serverless pasted URL with mismatched state', 'expected reject, observed reject');
    } else {
      log('FAIL', 'serverless pasted URL with mismatched state',
        `expected reject, observed accept; code="${code}"`);
    }
  }

  // Test 6: pasted URL with correct state
  {
    const {code, state} = parseAuthResponseUrl(
      `http://localhost:8888?code=legit_code&state=${expectedState}`,
    );
    if (state === expectedState && code === 'legit_code') {
      log('PASS', 'serverless pasted URL with matching state', 'expected accept, observed accept');
    } else {
      log('FAIL', 'serverless pasted URL with matching state', 'expected accept, observed reject');
    }
  }
}

async function main() {
  console.log('OAuth CSRF state validation — regression check');
  console.log('='.repeat(52));

  // Load compiled modules
  let LocalServerAuthorizationCodeFlow, OAuth2Client;
  try {
    const lmod = await import('./build/src/auth/localhost_auth_code_flow.js');
    LocalServerAuthorizationCodeFlow = lmod.LocalServerAuthorizationCodeFlow;
    const gmod = await import('google-auth-library');
    OAuth2Client = gmod.OAuth2Client;
  } catch (err) {
    console.error('Could not load modules. Run "npm install && npm run compile" first.');
    console.error(err.message);
    process.exit(2);
  }

  console.log('\n=== Localhost callback flow ===\n');
  await testLocalhostNoState(LocalServerAuthorizationCodeFlow, OAuth2Client);
  await testLocalhostWrongState(LocalServerAuthorizationCodeFlow, OAuth2Client);
  await testLocalhostCorrectState(LocalServerAuthorizationCodeFlow, OAuth2Client);

  await testServerlessCallbacks();

  console.log('\n' + '='.repeat(52));
  const passed = results.filter(r => r.tag === 'PASS').length;
  const failed = results.filter(r => r.tag === 'FAIL').length;
  console.log(`${passed} passed, ${failed} failed out of ${results.length} checks`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(2);
});
