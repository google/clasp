# Tests

These tests should ideally be run for every Pull Request, though due to the need to run `clasp login` before some commands, some tests are not run.


# Configuration using Travis

This is a bit more difficult, and why we include the `.clasprc.json.enc` file. The `.clasprc.json` file is used to authenticate many of the `clasp` commands, and is what is generated after using `clasp login`.

Here it is encrypted as `.clasprc.json.enc` and decrypted by Travis with the line:

```openssl aes-256-cbc -K $encrypted_0f9bbf7a60f4_key -iv $encrypted_0f9bbf7a60f4_iv -in .clasprc.json.enc -out .clasprc.json -d || true```

The way that Travis works is that encrypted files cannot be decrypted by a Pull Request from a fork (see: https://docs.travis-ci.com/user/encrypting-files/). There are ways around this, that may or may not be what we will do in the future, see (https://blog.algolia.com/travis-encrypted-variables-external-contributions/) for ideas.

This is why the end of that command ends with ` || true` (so Travis doesn't fail on any PR).

We need a way to keep track of this, so we don't try to run the tests and fail if we didn't decrypt the credentials. This is where this line comes in:

`- 'if [ "$TRAVIS_PULL_REQUEST" == "false" ]; then npm run test; fi'`

`$TRAVIS_PULL_REQUEST` is a default variable set by Travis to either the PR number or false. Since we only decrypt the variable on non-PRs, then we only use `npm run test` on those (such as when we merge to master or make a commit directly to master, etc).

### TODO

Change test files to use a flag that runs certain tests (what we're currently running) on PRs, and runs all tests on master.

# Configuration Locally

1. Make sure you are logged in (`clasp login`).
1. In `/tests/test.ts` change `describe.skip(...)` to `describe(...)` for relevant tests.
* **Note: (All tests are relevant).**
1. Rebuild: `npm run build`
1. Run `npm run test`

# Test these commands and configs.

## Commands:
 * [ ] clasp;
 * [ ] clasp login';
 * [ ] clasp login --no-localhost;
 * [x] clasp logout;
 * [x] clasp create "myTitle"
 * [x] clasp create <untitled>
 * [x] clasp list
 * [x] clasp clone <scriptId>
 * [x] clasp clone
 * [x] clasp pull
 * [x] clasp push
 * [ ] echo '// test' >> index.js && clasp push
 * [x] clasp open
 * [ ] clasp deployments
 * [ ] clasp deploy [version] [description]
 * [ ] clasp redeploy <deploymentId> <version> <description>
 * [ ] clasp version [description]
 * [x] clasp versions
 * [x] saveProjectId
 * [x] getScriptURL
 * [x] getFileType
 * [x] getAPIFileType
 ## Configs
 * [ ] .js and .gs files
 * [ ] Ignored files
