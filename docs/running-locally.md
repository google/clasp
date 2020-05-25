# Using clasp as a local dependency

Typically `clasp` is installed as a global package for convenience when using the command line.

Still there may be occasions when you want a project to use a specific version of `clasp` (i.e. to prevent potential breaking changes in future version)

This can be achieved by simply adding clasp as a local dependency and a fixed version

```sh
npm install --save-exact @google/clasp
```

Optionally, you can specify an older version.

```sh
npm install --save-exact @google/clasp@1.7.0
```

After this, any npm scripts using `clasp` will use the **local** version

```json
  "scripts": {
    "push-project1": "cd src/GasProject1 && clasp push",
  },
```

From the command line, within your project, use the `npx` tool in order to use the **local** version of `clasp` rather than any global one.

```sh
npx clasp --version
```
