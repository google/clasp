## Develop clasp

You can develop and test `clasp` on your computer by following these steps.

> Note: `clasp` uses TypeScript to provide autocompletion and linting when developing. Use an IDE like **Visual Studio Code** for TypeScript autocompletion.

### Setup

- Install `tsc`: `npm install -g typescript`
- Remove your local version of `clasp`: `sudo npm uninstall -g @google/clasp`
  - This will prevent errors when updating `node_modules`.
- Install dependencies: `npm i`

### After Making a Change

```sh
sudo npm run build;
clasp <command>
```

#### Build Errors?

If you're seeing build errors, try deleting `node_modules` and building `clasp` from scratch:

```sh
sudo rm -rf node_modules/
sudo npm run build-fresh
```

This is what @grant's terminal looks like:

```sh
sudo npm run build-fresh
Password:

> @google/clasp@1.5.3 build-fresh ~/Documents/github/google/clasp
> npm cache clean --force && npm i && npm run build

npm WARN using --force I sure hope you know what you are doing.
up to date in 2.464s

> @google/clasp@1.5.3 build ~/Documents/github/google/clasp
> tsc --project tsconfig.json && npm i -g --loglevel=error

/usr/local/bin/clasp -> /usr/local/lib/node_modules/@google/clasp/src/index.js
+ @google/clasp@1.5.3
updated 1 package in 2.768s
```

After seeing that message, you're ready to test out `clasp`!

### Run Tests

`clasp` has some unit tests that help detect errors. Build and run tests with these commands:

```sh
sudo npm run build;
npm run test
```

See [/tests/](/tests/) for more information.

### Lint

- Use `npm run lint` to find common style errors. TravisCI will autodetect these errors too.
- Download [sort-imports](https://marketplace.visualstudio.com/items?itemName=amatiasq.sort-imports) for VSC to automatically sort imports.

### Generate Docs

The core "How To" section of the docs is generated from JSDoc comments from `index.ts`.
Run `npm run docs` to build the "How To" section. Copy/paste that section into the README.md.

### Publishing `clasp` to npm (admin)

1. Build `index.js` locally. `.gitignore`/`.npmignore` will hide js/ts files appropriately.
1. Bump version: `npm version [major|minor|patch] -m "Bump version to %s"`
1. Push to GitHub: `git push --tags`
1. Publish with: `npm run publish`
