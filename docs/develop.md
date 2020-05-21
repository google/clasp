## Develop clasp

You can develop and test `clasp` on your computer by following these steps.

> Note: `clasp` uses TypeScript to provide autocompletion and linting when developing. Use an IDE like **Visual Studio Code** for TypeScript autocompletion.

### Setup

- Install `tsc`: `npm install -g typescript`
- Remove your local version of `clasp`: `npm uninstall -g @google/clasp`
  - This will prevent errors when updating `node_modules`.
- [Fork](https://help.github.com/en/github/getting-started-with-github/fork-a-repo) the `clasp` repository 
- Clone it to your device
```
git clone https://github.com/<your-github-username>/clasp.git
cd clasp
```
- Install dependencies: `npm install`

### After Making a Change

```sh
npm run build
clasp <command>
```

#### Build Errors?

If you're seeing build errors, try deleting the local `node_modules` and re-building `clasp` from scratch:

```sh
rm package-lock.json
rm -rf node_modules/
npm run build-fresh
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
npm run build;
npm run test
```

See [/test/](/test/) for more information.

### Lint

- Use `npm run lint` to find common style errors. TravisCI will autodetect these errors too.
- Download [sort-imports](https://marketplace.visualstudio.com/items?itemName=amatiasq.sort-imports) for VSC to automatically sort imports.
- Use `npm run prettier` to make the code pretty.

### Publishing `clasp` to npm (admin)

1. Build `index.js` locally. `.gitignore`/`.npmignore` will hide js/ts files appropriately.
1. Bump version: `npm version [major|minor|patch] -m "Bump version to %s"`
1. Push to GitHub: `git push --tags`
1. Publish with: `npm run publish`
