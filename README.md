# clasp [![Build Status](https://travis-ci.org/google/clasp.svg?branch=master)](https://travis-ci.org/google/clasp) [![Coverage Status](https://coveralls.io/repos/github/google/clasp/badge.svg?branch=master)](https://coveralls.io/github/google/clasp?branch=master) [![npm Version](https://img.shields.io/npm/v/@google/clasp.svg)](https://www.npmjs.com/package/@google/clasp) ![npm Downloads](https://img.shields.io/npm/dw/@google/clasp.svg)

Develop [Apps Script](https://developers.google.com/apps-script/) projects locally using clasp (*C*ommand *L*ine *A*pps *S*cript *P*rojects).

![clasp](https://user-images.githubusercontent.com/744973/35164939-43fd32ae-fd01-11e7-8916-acd70fff3383.gif)

**To get started, try out the [codelab](https://g.co/codelabs/clasp)!**

## Features

**🗺️ Develop Locally:** `clasp` allows you to develop your Apps Script projects locally. That means you can check-in your code into source control, collaborate with other developers, and use your favorite tools to develop Apps Script.

**🔢 Manage Deployment Versions:** Create, update, and view your multiple deployments of your project.

**📁 Structure Code:** `clasp` automatically converts your flat project on [script.google.com](script.google.com) into **folders**. For example:
- _On script.google.com_:
  - `tests/slides.gs`
  - `tests/sheets.gs`
- _locally_:
  - `tests/`
    - `slides.js`
    - `sheets.js`

## Install

First download `clasp`:

```sh
sudo npm i @google/clasp -g
```

Then enable Apps Script API: https://script.google.com/home/usersettings

## Commands

```sh
clasp
```
- `clasp login [--no-localhost]`
- `clasp logout`
- `clasp create [scriptTitle] [scriptParentId]`
- `clasp clone <scriptId>`
- `clasp pull`
- `clasp push`
- `clasp open [scriptId]`
- `clasp deployments`
- `clasp deploy [version] [description]`
- `clasp redeploy <deploymentId> <version> <description>`
- `clasp version [description]`
- `clasp versions`
- `clasp list`
- `clasp logs [--json] [--open]`

## How To...

### Login/Logout
```
clasp login
clasp logout
```

Run `clasp login --no-localhost` to manually enter a code instead of running a local server.

Run `clasp login --ownkey` to save the `.clasprc.json` file to your current working directory.

### Create a New Apps Script Project

Files in the current directory are added to the project. Optinally provide a script title or parent G Suite doc ID.

```
clasp create [scriptTitle] [scriptParentId]
```

![clasp-create](https://user-images.githubusercontent.com/11984923/39343526-274651d0-4992-11e8-94c7-765b3ba0a438.gif)
![clasp-create-no-name](https://user-images.githubusercontent.com/11984923/39343529-2b655e64-4992-11e8-8c33-48294fbfdfa2.gif)

### Clone an Existing Project in the Current Directory

```
clasp clone <scriptId>
```

### Push/Pull

```
clasp push # Updates Apps Script project with local files
clasp pull # Updates local files with Apps Script project
```

### Update a Published Project / Deploy

To deploy a project:

1. Create an immutable version of the Apps Script project using `clasp version`
1. Deploy the version using `clasp deploy [version]`

```
clasp versions # List versions
clasp version [description] # Create a new version with a description
```

then deploy...

```
clasp deploy [version] [description]
clasp undeploy <deploymentId>
clasp deployments # List all deployment IDs
```

### Open the Project on script.google.com

```
clasp open [scriptId]
```

Opens the `clasp` project on script.google.com. Provide a `scriptId` to open a different script.

### List your App Scripts (In Development)

```
clasp list
My Project           (1_M8ExSD9KI33fiVYbIOv-Cze0gWAzPYnPoSFb41eisVUOtyne8IDUjJ3)
Testing SlidesApp    (Cze0gWAzPYnPoSFb41eisVUOtyne8IDUjJg-1_M8ExSD9KI33fiVYbIOv)
Send Email           (isVUOtyne8IDUjJg-1_M8ExSD9KI33fiVYbIOvCze0gWAzPYnPoSFb41e)
...
```

This shows your 50 most recent scripts.

### See your Logs (In Development)

To use `clasp logs`, you need to enter your script's Google Cloud `projectId` into `.clasp.json`.

#### [Get Project ID](#get-project-id)

1. Run `clasp open`.
1. Click `Resources > Cloud Platform project...`
1. Copy the project ID `project-id-xxxxxxxxxxxxxxxxxxx` into `.clasp.json`. It should look like this:

```json
{
  "scriptId":"14Ht4FoesbNDhRbbTMI_IyM9uQ27EXIP_p2rK8xCOECg5s9XKpHp4fh3f",
  "projectId": "project-id-xxxxxxxxxxxxxxxxxxx"
}
```

Now you can run `clasp logs` for this project.

#### Run `clasp logs`

Use `clasp logs` to see recent log messages from StackDriver. For example:

```
clasp logs
ERROR Sat Apr 07 2018 10:58:31 GMT-0700 (PDT) myFunction      my log error
INFO  Sat Apr 07 2018 10:58:31 GMT-0700 (PDT) myFunction      info message
```

#### Other Options

- `clasp logs --json`: See the logs in JSON format.
- `clasp logs --open`: Open the StackDriver logs in your browser.

### Ignore File (`.claspignore`)

Like `.gitignore`, `.claspignore` allows you to ignore files that you do not wish to not upload on `clasp push`. Steps:

1. Create a file called `.claspignore` in your project's root directory.
1. Add patterns as if it were a .gitignore, and they will be excluded from `clasp push`.

A sample `.claspignore` could look like:

```
**/**
!build/main.js
!appsscript.json
```

In this example, `clasp` ignores everything but the manifest and `build/main.js`.

_Note_: the `.claspignore` file is parsed with [Anymatch](https://github.com/micromatch/anymatch), making it match files differently from a typical `.gitignore`, especially with directories. To ignore a directory, use syntax like `**/node_modules/**`.

### Project Settings File (`.clasp.json`)

When running `clone` or `create`, a file named `.clasp.json` is created in the current directory to describe `clasp`'s configuration for the current project. The following configuration values can be used in it:

#### `scriptId` (required)

Specifies the id of the Google Script project that clasp will target. It is the part located inbetween `/d/` and `/edit` in your project's URL: `https://script.google.com/d/<SCRIPT_ID>/edit`.

#### `rootDir` (optional)

Specifies the **local** directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

## Troubleshooting

The library requires **Node version >= 4.7.4**. Use this script to check your version and **upgrade Node if necessary**:

```sh
node -v # Check Node version
sudo npm install n -g
sudo n latest
```

## Develop

The Apps Script CLI uses TypeScript to provide autocompletion and linting when developing.
Use an IDE like **Visual Studio Code** for TypeScript autocompletion.

### Setup

Install `tsc`: `npm install -g typescript`

#### After Making a Change

```sh
sudo npm run build;
clasp <command>
```

#### Run Tests (experimental)

Change `describe.skip(...)` to `describe(...)` for relevant tests.

```sh
sudo npm run build;
npm run test
```

#### Publishing `clasp` to npm (admin)

1. Build `index.js` locally. `.gitignore`/`.npmignore` will hide js/ts files appropriately.
1. Bump versions, then publish with: `npm publish --access public`

### Contributing

The main purpose of this tool is to enable local Apps Script development.
If you have a core feature or use-case you'd like to see, find a GitHub issue or
create a detailed proposal of the use-case.
PRs are very welcome! See the [issues](https://github.com/google/clasp/issues) (especially **good first issue** and **help wanted**).

#### How to Submit a Pull Request

1. Look over the test cases in `tests/test.ts`, try cases that the PR may affect.
1. Run [tslint](https://palantir.github.io/tslint/): `npm run lint`.
1. Submit a pull request after testing your feature to make sure it works.

⚡ Powered by the [Apps Script API](https://developers.google.com/apps-script/api/).
