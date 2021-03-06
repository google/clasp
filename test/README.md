# Tests

`clasp`'s CLI commands have unit tests that:

- Run the `clasp` command
- Compares the expected `stdout` text and `stderr` code

## Testing Tools

- Testing framework: [Mocha.js](https://mochajs.org/)
- Testing CI: [GitHub actions](https://docs.github.com/en/actions)
  - Unit tests run for every Pull Request
- Testing % coverage: [Coveralls](https://coveralls.io/github/google/clasp?branch=master)

## How to Run Tests

1. Log in: `clasp login`
1. Rebuild: `npm run build`
1. Set environmental variables:
   - `export SCRIPT_ID=1EwE84eZCSBPcaAiJzCnDjmxMVnLQrDyhSKq1oZY6q-3x4BIDHgQefCnL`
   - `export PROJECT_ID=project-id-3961473932623644264`
1. Test: `npm run test`

## Configuration using Travis

> Note: The build may fail due to API quota limits. To solve this, wait 24 hours and then rebuild Travis.

GitHub automatically build and run tests on `clasp` for.

### Clasp login

Since CI can not log in, a `.clasprc.json` file is included that was created locally using `clasp login`.

> Use test account `claspcreds@gmail.com`. Password is private.

When updating the credentials, save the contents of the file in the github secret `DOT_CLASPRC`.

## Testing Status

This section tracks which `clasp` commands are tested. Unchecked checkboxes are test cases that still need to be added.

### Commands

- [ ] clasp;
- [ ] clasp login';
- [ ] clasp login --no-localhost;
- [x] clasp logout;
- [x] clasp create "myTitle"
- [x] clasp create \<untitled\>
- [x] clasp list
- [x] clasp clone \<scriptId\>
- [x] clasp clone
- [x] clasp pull
- [x] clasp push
- [ ] echo '// test' >> index.js && clasp push
- [x] clasp open
- [ ] clasp deployments
- [ ] clasp deploy [version][description]
- [ ] clasp version [description]
- [x] clasp versions
- [x] saveProject
- [x] getScriptURL
- [x] getLocalFileType
- [x] getAPIFileType

### Configs

- [ ] .js, .gs, .ts files
- [ ] Ignored files
