# Tests

`clasp`'s CLI commands have unit tests that:

- Run the `clasp` command
- Compares the expected `stdout` text and `stderr` code

## Testing Tools

- Testing framework: [Mocha.js](https://mochajs.org/)
- Testing CI: [Travis CI](https://travis-ci.org/google/clasp)
  - Unit tests run for every Pull Request
- Testing % coverage: [Coveralls](https://coveralls.io/github/google/clasp?branch=master)

## How to Run Tests

1. Log in: `clasp login`
1. Rebuild: `npm run build`
1. Set environmental variables:
    - `export TRAVIS_PULL_REQUEST=false`
    - `export SCRIPT_ID=1EwE84eZCSBPcaAiJzCnDjmxMVnLQrDyhSKq1oZY6q-3x4BIDHgQefCnL`
    - `export PROJECT_ID=project-id-3961473932623644264`
1. Test: `npm run test`

## Configuration using Travis

> Note: The build may fail due to API quota limits. To solve this, wait 24 hours and then rebuild Travis.

[Travis](https://travis-ci.org/) automatically build and run tests on `clasp` for.

### Clasp login

Since Travis cannot `clasp login`, a `.clasprc.json` file is included that was created locally using `clasp login`.

> Use test account `claspcreds@gmail.com`. Password is private.

To then encrypt the `.clasprc.json` file, use these commands using the [Travis CLI](https://github.com/travis-ci/travis.rb):

```sh
clasp login
cp ~/.clasprc.json ./tests/.clasprc.json
travis encrypt-file ./tests/.clasprc.json --add
```

This will add the following line to `.travis.yml`, which decrypts that file:

```sh
openssl aes-256-cbc -K $encrypted_0f9bbf7a60f4_key -iv $encrypted_0f9bbf7a60f4_iv -in .clasprc.json.enc -out .clasprc.json -d || true
```

Now move `.clasprc.json.enc` to the `/tests/` folder:

```sh
rm ./tests/.clasprc.json.enc
cp .clasprc.json.enc ./tests/.clasprc.json.enc
rm ./.clasprc.json.enc
```

And edit the `openssl` command in `.travis.yml` file:

- Change the `-in` file to `./tests/.clasprc.json.enc`
- Change the `-out` file to `.clasprc.json`
- Add `|| true` to the end of the command

> Note: [Travis will not decrypt files on a Pull Request from a fork.](https://docs.travis-ci.com/user/encrypting-files/)

There are complicated ways around this. [Ideas](https://blog.algolia.com/travis-encrypted-variables-external-contributions/).

> Note: The command ends with `|| true` so Travis doesn't immediately fail on any PR.

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
- [ ] clasp deploy [version] [description]
- [ ] clasp version [description]
- [x] clasp versions
- [x] saveProject
- [x] getScriptURL
- [x] getFileType
- [x] getAPIFileType

### Configs

- [ ] .js, .gs, .ts files
- [ ] Ignored files
