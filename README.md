<h1 align="center">
  <br>
  clasp
  <br>
</h1>

<p align="center"><a href="https://travis-ci.org/google/clasp"><img src="https://travis-ci.org/google/clasp.svg?branch=master" alt="Build Status"></a> <a href="https://coveralls.io/github/google/clasp?branch=master"><img src="https://coveralls.io/repos/github/google/clasp/badge.svg?branch=master" alt="Coverage Status"></a> <a href="https://www.npmjs.com/package/@google/clasp"><img src="https://img.shields.io/npm/v/@google/clasp.svg" alt="npm Version"></a> <a href="https://www.npmjs.com/package/@google/clasp"><img src="https://img.shields.io/npm/dw/@google/clasp.svg" alt="npm Downloads"></a> <a href="http://packagequality.com/#?package=%40google%2Fclasp"><img src="http://npm.packagequality.com/shield/%40google%2Fclasp.svg" alt="Package Quality"></a></p>

> Develop [Apps Script](https://developers.google.com/apps-script/) projects locally using clasp (*C*ommand *L*ine *A*pps *S*cript *P*rojects).

<!-- GIF bash prompt: PS1='\[\033[38;5;9m\]❤  \[$(tput sgr0)\]' -->
<!-- Width: 888px -->
<!-- Commands:
clasp create "Hello"
ls
echo 'function hello() {
  Logger.log("Hello, Apps Script!");
}' >> hello.js
clasp push
clasp deploy
rm .clasp.json appsscript.json hello.js
clear
-->
![clasp](https://user-images.githubusercontent.com/744973/42856573-a5d96d7c-89fa-11e8-9d69-8d2c66f00d8d.gif)

**To get started, try out the [codelab](https://g.co/codelabs/clasp)!**

## Features

**🗺️ Develop Locally:** `clasp` allows you to develop your Apps Script projects locally. That means you can check-in your code into source control, collaborate with other developers, and use your favorite tools to develop Apps Script.

**🔢 Manage Deployment Versions:** Create, update, and view your multiple deployments of your project.

**📁 Structure Code:** `clasp` automatically converts your flat project on [script.google.com](https://script.google.com) into **folders**. For example:
- _On script.google.com_:
  - `tests/slides.gs`
  - `tests/sheets.gs`
- _locally_:
  - `tests/`
    - `slides.js`
    - `sheets.js`

**🔷 Write Apps Script in TypeScript:** Write your Apps Script projects using TypeScript features:
- Arrow functions
- Optional structural typing
- Classes
- Type inference
- Interfaces
- [And more...](docs/typescript.md)

## Install

First download `clasp`:

```sh
sudo npm i @google/clasp -g
```

Then enable Apps Script API: https://script.google.com/home/usersettings

(If that fails, run this:)
```sh
sudo npm i -g grpc @google/clasp --unsafe-perm
```

## Commands

```sh
clasp
```
- [`clasp login [--no-localhost] [--creds <file>]`](#login)
- [`clasp logout`](#logout)
- [`clasp create [scriptTitle] [scriptParentId] [--rootDir]`](#create)
- [`clasp clone <scriptId>`](#clone)
- [`clasp pull [--versionNumber]`](#pull)
- [`clasp push [--watch]`](#push)
- [`clasp open [scriptId] [--webapp]`](#open)
- [`clasp deployments`](#deployments)
- [`clasp deploy [version] [description]`](#deploy)
- [`clasp redeploy <deploymentId> <version> <description>`](#redeploy)
- [`clasp version [description]`](#version)
- [`clasp versions`](#versions)
- [`clasp list`](#list)
- [`clasp logs [--json] [--open] [--watch]`](#logs)

## How To...

### Login

Logs the user in. Saves the client credentials to an rc file.

#### Options

- `--no-localhost`: Do not run a local server, manually enter code instead.
- `--creds`: Save .clasprc.json file to current working directory.

### Logout

Logs out the user by deleting client credentials.

#### Examples

- `clasp logout`

### Create

Creates a new script project.

#### Options

- `scriptTitle`: An optional project title.
- `scriptParentId`: An optional project parent Id. The Drive ID of a parent file that the created script project is bound to. This is usually the ID of a Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a standalone script project is created.
- `rootDir`: Local directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

#### Examples

- `clasp create`
- `clasp create "My Script"`
- `clasp create "My Script" "1D_Gxyv*****************************NXO7o"`
- `clasp create "My Script" "1D_Gxyv*****************************NXO7o" --rootDir ./dist`

### Clone

Clones the script from script.google.com

#### Options

- `scriptId`: The script project to clone.

#### Examples

- `clasp clone scriptId`

### Pull

Fetches a project from either a provided or saved script id.
Updates local files with Apps Script project.

#### Options

- `versionNumber`: The version number of the project to retrieve.

#### Examples

- `clasp pull`
- `clasp pull --versionNumber 23`

### Push

Force writes all local files to the script management server.

#### Examples

- `clasp push`: Pushes local files to script.google.com
- `clasp push --watch`: Watches local file changes. Pushes files when there's a change.

Ignores files:
- That start with a .
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the ignore file)

### Status

Lists files that will be written to the server on `push`.

#### Examples

- `clasp status`

Ignores files:
- That start with a .
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the ignore file)

### Open

Opens the `clasp` project on script.google.com. Provide a `scriptId` to open a different script.

#### Options

- `scriptId`: The optional script project to open.
- `webapp`: open web application in a browser.

#### Examples

- `clasp open`
- `clasp open [scriptId]`
- `clasp open --webapp`

### Deployments

List deployments of a script

#### Examples

- `clasp deployments`

### Deploy

Creates a version and deploys a script.
The response gives the version of the deployment.

#### Options

- `version`: The version number.
- `description`: The deployment description.

#### Examples

- `clasp deploy`
- `clasp deploy 4`
- `clasp deploy 7 "Updates sidebar logo."`

### Undeploy

Undeploys a deployment of a script.

#### Options

- `deploymentId`: deploymentId The deployment ID.

#### Examples

- `clasp undeploy "123"`

### Redeploy

Updates deployments of a script.

#### Options

- `deploymentId`: deploymentId The deployment ID.
- `version`: version The target deployment version.
- `description`: description The reason why the script was redeployed.

#### Examples

- `clasp redeploy 123 3 "Why I updated the deployment"`

### Versions

List versions of a script.

#### Examples

- `clasp versions`

### Version

Creates an immutable version of the script.

#### Options

- `description`: description The description of the script version.

#### Examples

- `clasp version`
- `clasp version "Bump the version."`

### List

Lists your most recent 10 Apps Script projects.

#### Examples

- `clasp list # helloworld1 – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ...`

### Logs

Prints out 5 most recent the StackDriver logs.

> **NOTE**: It requires Project ID setup (see below).

#### Options

- `json`: json Output logs in json format.
- `open`: open Open StackDriver logs in a browser.

#### Examples

```
clasp logs
ERROR Sat Apr 07 2018 10:58:31 GMT-0700 (PDT) myFunction      my log error
INFO  Sat Apr 07 2018 10:58:31 GMT-0700 (PDT) myFunction      info message
```

- `clasp logs --json`: See the logs in JSON format.
- `clasp logs --open`: Open the StackDriver logs in your browser.
- `clasp logs --watch`: Retrieves the newest logs every 5 seconds.

### Run

Remotely executes an Apps Script function.
This function runs your script in the cloud. You must supply
the functionName params. For now, it can
only run functions that do not require other authorization.

> **NOTE**: It requires Project ID setup (see below).

#### Options

- `functionName`: functionName The function in the script that you want to run.
- `dev`: dev Run script function in devMode.

#### Examples

- `clasp run 'sendEmail'`

### Help

Displays the help function.

#### Examples

- `clasp help`

## Guides

### [Get Project ID](#get-project-id)

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

### Ignore File (`.claspignore`)

Like `.gitignore`, `.claspignore` allows you to ignore files that you do not wish to not upload on `clasp push`. Steps:

1. Create a file called `.claspignore` in your project's root directory.
2. Add patterns to be excluded from `clasp push`. _Note_: The `.claspignore` file is parsed with [Anymatch](https://github.com/micromatch/anymatch), which is different from `.gitignore`, especially for directories. To ignore a directory, use syntax like `**/node_modules/**`.

A sample `.claspignore` ignoring everything except the manifest and `build/main.js`:

```
**/**
!build/main.js
!appsscript.json
```

## Project Settings File (`.clasp.json`)

When running `clone` or `create`, a file named `.clasp.json` is created in the current directory to describe `clasp`'s configuration for the current project. Example `.clasp.json`:

```json
{
  "scriptId": "",
  "rootDir": "build/",
  "fileExtension": "ts",
  "filePushOrder": ["file1.ts", "file2.ts"]
}
```

The following configuration values can be used:

### `scriptId` (required)

Specifies the id of the Google Script project that clasp will target. It is the part located inbetween `/d/` and `/edit` in your project's URL: `https://script.google.com/d/<SCRIPT_ID>/edit`.

### `rootDir` (optional)

Specifies the **local** directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

### `fileExtension` (optional)

Specifies the file extension for **local** script files in your Apps Script project.

### `filePushOrder` (optional)

Specifies the files that should be pushed first, useful for scripts that rely on order of execution. All other files are pushed after this list of files.

## Troubleshooting

The library requires **Node version >= 4.7.4**. Use this script to check your version and **upgrade Node if necessary**:

```sh
node -v # Check Node version
sudo npm install n -g
sudo n latest
```

## README Badge

Using clasp for your project? Add a README badge to show it off: [![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg)](https://github.com/google/clasp)

```
[![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg)](https://github.com/google/clasp)
```

## Develop clasp

See [the develop guide](docs/develop.md) for instructions on how to build `clasp`. It's not that hard!

## Contributing

The main purpose of this tool is to enable local Apps Script development.
If you have a core feature or use-case you'd like to see, find a GitHub issue or
create a detailed proposal of the use-case.
PRs are very welcome! See the [issues](https://github.com/google/clasp/issues) (especially **good first issue** and **help wanted**).

### How to Submit a Pull Request

1. Look over the test cases in `tests/test.ts`, try cases that the PR may affect.
1. Run [tslint](https://palantir.github.io/tslint/): `npm run lint`.
1. Submit a pull request after testing your feature to make sure it works.

⚡ Powered by the [Apps Script API](https://developers.google.com/apps-script/api/).
