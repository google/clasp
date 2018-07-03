# Tests

Many of `clasp`'s CLI commands have unit tests that run the `clasp` command and asserts the std output and std error code is as expected.

These tests should ideally be run for every Pull Request, though due to the need to run `clasp login` before some commands, some tests are not run.

To run tests yourself, follow the __Local Configuration__ instructions.

## Local Configuration

1. Make sure you are logged in (`clasp login`).
1. Rebuild: `sudo npm run build`
1. Run `npm run test`

## Configuration using Travis

> Note: If the build is failing, it may be because of API quota limits. Wait a bit and then rebuild Travis.

Travis (https://travis-ci.org/) is used to automatically build and run tests on `clasp`. Every version of `clasp` should pass the Travis build step before release.

Since Travis cannot `clasp login`, a `.clasprc.json` file is included that was created locally using `clasp login`.

To then encrypt the `.clasprc.json` file, use these commands using the [Travis CLI](https://github.com/travis-ci/travis.rb):

```sh
clasp login
cp ~/.clasprc.json ./tests/.clasprc.json
travis encrypt-file ./tests/.clasprc.json --add
```

This will add the following line to `.travis.yml`, which decrypts that file:

```openssl aes-256-cbc -K $encrypted_0f9bbf7a60f4_key -iv $encrypted_0f9bbf7a60f4_iv -in .clasprc.json.enc -out .clasprc.json -d || true```

Make sure to commit the `./tests/.clasprc.json.enc`.

Travis will not decrypt files on a Pull Request from a fork (see: https://docs.travis-ci.com/user/encrypting-files/).

There are complicated ways around this, see (https://blog.algolia.com/travis-encrypted-variables-external-contributions/) for ideas.

The command ends with ` || true` so Travis doesn't immediately fail on any PR.

## Test these commands and configs.

### Commands:
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
 ### Configs
 * [ ] .js and .gs files
 * [ ] Ignored files
