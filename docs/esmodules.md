# ES Modules

Currently, Google Apps Script does **not** support ES modules. Hence the typical `export`/`import` pattern cannot be used and will fail.

One way of handling this is to use [rollup.js](https://rollupjs.org/) to bundle your project into on a single JavaScript file.

The trick here is to make sure not to export any functions in your entry point code, e.g. `index.ts`, _and_ to prevent any generation of export statement in the final bundle (see the custom rollup plugin in the `rollup.config.js` below).

```js
import { babel } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const extensions = [".ts", ".js"];

const preventThreeShakingPlugin = () => {
    return {
      name: 'no-threeshaking',
      resolveId(id, importer) {
        if (!importer) {
            // let's not theeshake entry points, as we're not exporting anything in Apps Script files
          return {id, moduleSideEffects: "no-treeshake" }
        }
        return null;
      }
    }
  }

export default {
  input: "./src/index.ts",
  output: {
    dir: "build",
    format: "esm",
  },
  plugins: [
    preventThreeShakingPlugin(),
    nodeResolve({
      extensions,
    }),
    babel({ extensions, babelHelpers: "runtime" }),
  ],
};
```

In order to use [babel](https://babeljs.io/) to transpile the code, be sure to add a `babel.config.js` to the project:

```js
module.exports = {
  presets: [
    [
      // ES features necessary for user's Node version
      require("@babel/preset-env").default,
      {
        targets: {
          node: "current",
        },
      },
    ],
    [require("@babel/preset-typescript").default],
  ],
};
```

In the above example, the resulting bundle created by transpiling the entry point in `./src` will end up in the `./build`-folder. To make sure Clasp picks the right files to push, a `.claspignore`-file must be added to the project:

```ignore
# ignore all files…
**/**

# except the extensions…
!appsscript.json
!build/*.js

# ignore even valid files if in…
.git/**
node_modules/**
```

This should be enough to start developing a project using ES Modules.