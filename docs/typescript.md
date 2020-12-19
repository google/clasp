# TypeScript

[TypeScript](https://www.typescriptlang.org/) is a typed superset of JavaScript that can compile to plain Apps Script.
Using TypeScript with your `clasp` project allows you to use features such as:

- Arrow functions
- Optional structural typing
- Classes
- Type inference
- Interfaces
- And more…

Starting with version  `1.5.0`, Clasp allows **new** and **existing** Apps Script projects to use TypeScript.

> Note: Once you use TypeScript, you cannot develop on script.google.com (the [transpiled](https://en.wikipedia.org/wiki/Source-to-source_compiler) code).

> Warning: Apps Script's runtime/execution is different than Node or web browsers. In particular, you cannot use the terms `export` or `require` in the same way you would with Node. You cannot use `window` like in web browsers.

## Quickstart

This quickstart guide describes how to create a TypeScript project from scratch.

### Prerequisites

1. Ensure you have upgraded to clasp's version >= 1.5.0
    - `clasp -v`

1. Install TypeScript definitions for Apps Script in your project's folder.
    - `npm i -S @types/google-apps-script`

1. Create a file called `tsconfig.json` to enable TypeScript features:

```json
{
  "compilerOptions": {
    "lib": ["esnext"],
    "experimentalDecorators": true
  }
}
```

(See [1](https://github.com/Microsoft/monaco-editor/issues/61#issuecomment-342359348) [2](https://code.visualstudio.com/docs/languages/jsconfig#_jsconfig-options) [esnext](https://basarat.gitbooks.io/typescript/docs/types/lib.d.ts.html))

### Create the TypeScript Project

Create a clasp project in an empty directory (or use an existing project):

```sh
clasp create --type standalone
```

Create a TypeScript file called `hello.ts` with the following contents:

```ts
const greeter = (person: string) => {
  return `Hello, ${person}!`;
}

function testGreeter() {
  const user = 'Grant';
  Logger.log(greeter(user));
}
```

> Note: This is a valid TypeScript file (but an invalid Apps Script file). That's OK.

### Push the project to the Apps Script server

Push the TypeScript file to the Apps Script server:

```sh
clasp push
```

> Note: clasp automatically transpiles `.ts` files to valid Apps Script files upon `clasp push`.

### Verify the project works on script.google.com

Open the Apps Script project on script.google.com:

```sh
clasp open
```

Notice how a transpiled version of your project was pushed to the Apps Script server.

Run `testGreeter()` and press `View` > `Logs` to view the logs to see the result.

## TypeScript Examples

This section lists TypeScript examples derived from [this guide](https://angular-2-training-book.rangle.io/handout/features/):

These features allow you to write Apps Script concisely with intelligent IDE errors and autocompletions.

```ts
// Optional Types
let isDone: boolean = false;
let height: number = 6;
let bob: string = "bob";
let list1: number[] = [1, 2, 3];
let list2: Array<number> = [1, 2, 3];
enum Color {Red, Green, Blue};
let c: Color = Color.Green;
let notSure: any = 4;
notSure = "maybe a string instead";
notSure = false; // okay, definitely a boolean
function showMessage(data: string): void { // Void
 console.log(data);
}
showMessage('hello');

// Classes
class Hamburger {
  constructor() {
    // This is the constructor.
  }
  listToppings() {
    // This is a method.
  }
}

// Template strings
var name = 'Sam';
var age = 42;
console.log(`hello my name is ${name}, and I am ${age} years old`);

// Rest arguments
const buildName = (first: string, ...rest) => first + ' ' + rest.join(' ');
buildName('First', 'Second', 'Third');

// Spread operator (array)
let cde = ['c', 'd', 'e'];
let scale = ['a', 'b', ...cde, 'f', 'g'];  // ['a', 'b', 'c', 'd', 'e', 'f', 'g']

// Spread operator (map)
let mapABC  = { a: 5, b: 6, c: 3};
let mapABCD = { ...mapABC, d: 7};  // { a: 5, b: 6, c: 3, d: 7 }

// Destructure map
let jane = { firstName: 'Jane', lastName: 'Doe'};
let john = { firstName: 'John', lastName: 'Doe', middleName: 'Smith' }
function sayName({firstName, lastName, middleName = 'N/A'}) {
  console.log(`Hello ${firstName} ${middleName} ${lastName}`)  
}
sayName(jane) // -> Hello Jane N/A Doe
sayName(john) // -> Helo John Smith Doe

// Export (The export keyword is ignored)
export const pi = 3.141592;

// Google Apps Script Services
var doc = DocumentApp.create('Hello, world!');
doc.getBody().appendParagraph('This document was created by Google Apps Script.');

// Decorators
function Override(label: string) {
  return function (target: any, key: string) {
    Object.defineProperty(target, key, {
      configurable: false,
      get: () => label
    });
  }
}
class Test {
  @Override('test') // invokes Override, which returns the decorator
  name: string = 'pat';
}
let t = new Test();
console.log(t.name); // 'test'
```

After installing `@types/google-apps-script`, editors like Visual Studio Code autocomplete types:

```ts
var doc = DocumentApp.create('Hello, world!');
doc.getBody().appendParagraph('This document was created by Google Apps Script.');
Logger.log(doc.getUrl());
```

In this case, we could write the fully qualified type:

```ts
const doc: GoogleAppsScript.Document.Document = DocumentApp.create('Hello, world!');
```

Or inferred type:

```ts
const doc = DocumentApp.create('Hello, world!');
```

In most cases, the inferred type is sufficient for Apps Script autocompletion.

## How it works

`clasp push` transpiles ES6+ into ES3 (using [`ts2gas`](https://github.com/grant/ts2gas)) before pushing files to the Apps Script server.

## Gotchas

### Advanced Services

Enabling advanced services modifies the `appsscript.json` file on script.google.com. After enabling an advanced service in the UI, copy the `appsscript.json` file from script.google.com into your editor to use the advanced services in your project.

Advanced Service should have TypeScript autocompletion.

### TypeScript Support

Currently, `clasp` supports [`typescript@3.8.2`](https://www.npmjs.com/package/typescript/v/3.8.2). If there is a feature in a newer TypeScript version that you'd like to support, or some experimental flag you'd like enabled, please open an issue.

#### TypeScript configuration

- You can create a TypeScript configuration file by creating a `tsconfig.json` file in the same folder as your `.clasp.json` file.
- Only the `"compilerOptions"` section is considered. Anything else is ignored.

By default `"compilerOptions"` uses these options:

```json
{
  "isolatedModules": true,
  "noLib": true,
  "noResolve": true,
  "target": "ES3",
  "module": "None",
  "noImplicitUseStrict": true,
  "experimentalDecorators": true,
}
```

> Note that the options `isolatedModules`, `noLib`, `noResolve` and `module` cannot be changed.

##### V8 engine support

If your Apps Script project is configured to use the V8 Engine, you should set `"target": "ES2019"`  in your `tsconfig.json`.

### Modules, exports and imports

Currently, Google Apps Script does **not** support ES modules. Hence the typical `export`/`import` pattern cannot be used and the example below will fail:

```ts
// module.ts

// `foo` is added to the `exports` object in the global namespace
export const foo = 'Hello from Module';
```

```ts
// main.ts
import { foo } from './module'; // this statement is ignored

// the variable `foo` does not exist in the global namespace
const bar = foo;
```

There are some possible workaround though:

#### The `exports` declaration workaround

This workaround makes TypeScript aware of the `exports` object and its "imported" content. Please be aware that this approach does not even remotely offer proper code isolation one would assume from using modules and can cause issues that will be very hard to debug.

```ts
declare const exports: typeof import('./module');

exports.foo;  // address "imported" content as it will be visible when transpiled
```

#### The `namespace` statement workaround

This workaround takes advantage of TypeScript "namespaces" (formerly known as "internal module") and achieves proper code isolation.

Namespace definition can be nested, spread over multiple files and do not need any `import`/`require` statement to be used.

```ts
// module.ts
namespace Module {
  export function foo() {}
  function bar() {}  // this function can only be addressed from within the `Module` namespace
}
```

```ts
// anyFiles.ts
Module.foo();  // address a namespace's exported content directly

const nameIWantForMyImports = Module.foo;  // to simulate `import` with renaming
nameIWantForMyImports();
```

For a more detailed example on how `namespace`s can be used in a project you can visit [ts-gas-project-starter](https://github.com/PopGoesTheWza/ts-gas-project-starter)

#### The third party build-chain workaround

Here the idea is to use third party tools ([webpack](https://webpack.js.org/), [rollup.js](https://rollupjs.org/), [gulp](https://gulpjs.com/), etc.) to do the following:

1. parse your code and indentify module used (`export`and `import`)
1. *(optional)* do some tree shaking in order to remove unused code
1. pack the result into a single javascript package

> At one of the steps above, transpilling TypeScript into JavaScript must occur (either by using TypeScript or [Babel](https://babeljs.io/)) but which precise step will be defined by the set of third party tools you choose and how you define your build chain.

For an example on how this could be set up using [rollup.js](https://rollupjs.org/), see [esmodules.md](./esmodules.md).

Documenting in detail any solution with third party tools is currently beyond the scope of this document. If you happen to setup such a build chain and want to share it with the community, please open an issue so that it can be reviewed and evaluated for completing the documentation.

### Apps Script Libraries and TypeScript

If your project contains libraries referenced in `appsscript.json`, TypeScript will throw errors for the library names or types it cannot resolve, e.g. `[ts] Cannot find name 'OAuth2'. [2304]`. Libraries have their own types and are not part of `@types/google-apps-script`. These libraries are only resolved once the script is deployed upstream with `clasp push`.

If the @types npm package exists for a GAS library, you can install it as so:

```
npm install -D @types/google-apps-script-oauth2
```

Add the types reference to your `tsconfig.json` file:

```
{
  "compilerOptions": {
    "types": ["google-apps-script", "google-apps-script-oauth2"],
    "strict": true
  }
}

```

Not all libraries will have type definitions, so you may have to create your own. Refer to the [Outdated Types](##Outdated-Types) section below for more details.

If you do not want to generate types, a lazier workaround for this error is to ignore the line causing the TypeScript error by adding a line comment `// @ts-ignore` above the line. This can be done as so:

```ts
function getOAuthService() {
    // Ignore OAuth2 library resolution when working locally with clasp and TypeScript
    // @ts-ignore
    return OAuth2.createService('Auth0');
}
```

## Outdated Types

TypeScript types for Apps Script are currently generated manually.

If you see outdated TypeScript types, you can help update them by contributing to [@types/google-apps-script](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/google-apps-script).

### How to Generate Types

1. Fork [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)
1. Run the types generator by following the instructions at [motemen/dts-google-apps-script](https://github.com/motemen/dts-google-apps-script)
1. Copy the type files to your fork of `DefinitelyTyped/DefinitelyTyped`.
1. View the diff (`git diff`), and make sure that the types look OK.
1. Make a PR and ask [@grant](https://github.com/grant) for review.

## Further Reading

- Consider using a linter like [`gts`](https://github.com/google/gts) to increase the quality of your TypeScript projects.
