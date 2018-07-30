# TypeScript

[TypeScript](https://www.typescriptlang.org/) is a typed superset of JavaScript that can compile to plain Apps Script.
Using TypeScript with your `clasp` project can allow you to use TypeScript features such as:
- Arrow functions
- Optional structural typing
- Classes
- Type inference
- Interfaces
- And more...

Clasp `1.5.0` allows **new** and **existing** Apps Script projects to use TypeScript.

> Note: Once you use TypeScript, you cannot develop on script.google.com (the [transpiled](https://en.wikipedia.org/wiki/Source-to-source_compiler) code).

> Warning: Apps Script's runtime/execution is different than Node or web browers. In particular, you cannot use the terms `export` or `require` in the same way you would with Node. You cannot use `window` like in web browsers.

## Quickstart

This quickstart guide describes how to create a TypeScript project from scratch.

### Prerequisites

1. Ensure you have upgrade to clasp >= 1.5.0
  - `clasp -v`
1. Install TypeScript definitions for Apps Script in your project's folder.
  - `npm i -S @types/google-apps-script`

### Create the TypeScript Project

Create a clasp project in an empty directory (or use an existing project):

```sh
clasp create
```

If you haven't already, run `npm i -S @types/google-apps-script` to allow your code editor to autocomplete TypeScript.

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
 alert(data);
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
const add = (a, b) => a + b;
let args = [3, 5];
add(...args); // same as `add(args[0], args[1])`, or `add.apply(null, args)`

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

Enableing advanced services modifies the `appsscript.json` file on script.google.com. After enabling an advanced service in the UI, copy the `appsscript.json` file from script.google.com into your editor to use the advanced services in your project.

### TypeScript Support

Currently, `clasp` supports [`typescript@2.9.2`](https://www.npmjs.com/package/typescript/v/2.9.2). If there is a feature in a newer  TypeScript version that you'd like to support, or some experimental flag you'd like enabled, please file a bug.

## Further Reading

- Consider using a linter like [`tslint`](https://github.com/palantir/tslint) to increase the quality of your TypeScript projects.
