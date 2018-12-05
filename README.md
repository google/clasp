<h1 align="center">
  <br>
  clasp
  <br>
</h1>

<p align="center"><a href="https://travis-ci.org/google/clasp"><img src="https://travis-ci.org/google/clasp.svg?branch=master" alt="Build Status"></a> <a href="https://coveralls.io/github/google/clasp?branch=master"><img src="https://coveralls.io/repos/github/google/clasp/badge.svg?branch=master" alt="Coverage Status"></a> <a href="https://www.npmjs.com/package/@google/clasp"><img src="https://img.shields.io/npm/v/@google/clasp.svg" alt="npm Version"></a> <a href="https://npmcharts.com/compare/@google/clasp?minimal=true"><img src="https://img.shields.io/npm/dw/@google/clasp.svg" alt="npm Downloads"></a> <a href="http://packagequality.com/#?package=%40google%2Fclasp"><img src="http://npm.packagequality.com/shield/%40google%2Fclasp.svg" alt="Package Quality"></a></p>

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

The following command provide basic Apps Script project management.

> Note: Most of them require you to `clasp login` and `clasp create/clone` before using the rest of the commands.

```sh
clasp
```
- [`clasp login [--no-localhost] [--creds <file>]`](#login)
- [`clasp logout`](#logout)
- [`clasp create [--title <title>] [--type <type>] [--rootDir <dir>] [--parentid <id>]`](#create)
- [`clasp clone <scriptId | scriptURL>`](#clone)
- [`clasp pull [--versionNumber]`](#pull)
- [`clasp push [--watch] [--force]`](#push)
- [`clasp status`](#status)
- [`clasp open [scriptId] [--webapp]`](#open)
- [`clasp deployments`](#deployments)
- [`clasp deploy [--versionNumber <version>] [--description <description>] [--deploymentId <id>]`](#deploy)
- [`clasp undeploy [deploymentId]`](#undeploy)
- [`clasp version [description]`](#version)
- [`clasp versions`](#versions)
- [`clasp list`](#list)

### Advanced Commands

> **NOTE**: These commands require Project ID/credentials setup (see below).

- [`clasp logs [--json] [--open] [--watch]`](#logs)
- [`clasp run [functionName] [--nondev]`](#run)
- [`clasp apis list`](#apis)
- [`clasp apis enable <api>`](#apis)
- [`clasp apis disable <api>`](#apis)
- [`clasp setting <key> [value]`](#setting)

## Reference

### Login

Logs the user in. Saves the client credentials to a `.clasprc.json` file.

#### Options

- `--no-localhost`: Do not run a local server, manually enter code instead.
- `--creds <file>`: Use custom credentials. Saves a `.clasprc.json` file to current working directory. This file should be private!

### Logout

Logs out the user by deleting client credentials.

#### Examples

- `clasp logout`

### Create

Creates a new script project. Prompts the user for the script type if not specified.

#### Options

- `--type [docs/sheets/slides/forms]`: If specified, creates a new add-on attached to a Document, Spreadsheet, Presentation, or Form. If `--parentId` is specified, this value is ignored.
- `--title`: A project title.
- `--rootDir`: Local directory in which clasp will store your project files. If not specified, clasp will default to the current directory.
- `--parentId`: A project parent Id.
  - The Drive ID of a parent file that the created script project is bound to. This is usually the ID of a Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a standalone script project is created.

#### Examples

- `clasp create`
- `clasp create --type standalone` (default)
- `clasp create --type docs`
- `clasp create --type sheets`
- `clasp create --type slides`
- `clasp create --type forms`
- `clasp create --type webapp`
- `clasp create --type api`
- `clasp create --title "My Script"`
- `clasp create --rootDir ./dist`
- `clasp create --parentid "1D_Gxyv*****************************NXO7o"`

These options can be combined like so:

- `clasp create --title "My Script" --parentid "1D_Gxyv*****************************NXO7o" --rootDir ./dist`

### Clone

Clones the script project from script.google.com.

#### Options

- `scriptId | scriptURL`: The script ID _or_ script URL to clone.

#### Examples

- `clasp clone 15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC`
- `clasp clone https://script.google.com/d/15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC/edit`

### Pull

Fetches a project from either a provided or saved script ID.
Updates local files with Apps Script project.

#### Options

- `--versionNumber`: The version number of the project to retrieve.

#### Examples

- `clasp pull`
- `clasp pull --versionNumber 23`

### Push

Force writes all local files to script.google.com.

Ignores files:
- That start with a `.`
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the `.claspignore` file)

#### Options

- `--watch`: Watches local file changes. Pushes files every few seconds.
- `-f` `--force`: Forcibly overwrites the remote manifest.

#### Examples

- `clasp push`
- `clasp push --watch`

### Status

Lists files that will be written to the server on `push`.

Ignores files:
- That start with a `.`
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the ignore file)

#### Examples

- `clasp status`

### Open

Opens the current directory's `clasp` project on script.google.com. Provide a `scriptId` to open a different script. Can also open web apps.

#### Options

- `scriptId`: The optional script project to open.
- `webapp`: open web application in a browser.

#### Examples

- `clasp open`
- `clasp open [scriptId]`
- `clasp open --webapp`

### Deployments

List deployments of a script.

#### Examples

- `clasp deployments`

### Deploy

Creates a version and deploys a script.
The response gives the version of the deployment.

#### Options

- `-V <version>` `--versionNumber <version>`: The project version to deploy at.
- `-d <description>` `--description <description>`: The deployment description.
- `-i <id>` `--deploymentId <id>`: The deployment ID to redeploy.

#### Examples

- `clasp deploy` (create new deployment and new version)
- `clasp deploy --versionNumber 4` (create new deployment)
- `clasp deploy --desc "Updates sidebar logo."` (deploy with description)
- `clasp deploy --deploymentId 123` (create new version)
- `clasp deploy -V 7 -d "Updates sidebar logo." -i 456`

### Undeploy

Undeploys a deployment of a script.

#### Options

- `deploymentId`: An optional deployment ID.

#### Examples

- `clasp undeploy` (undeploy the last deployment.)
- `clasp undeploy "123"`

### Version

Creates an immutable version of the script.

#### Options

- `description`: description The description of the script version.

#### Examples

- `clasp version`
- `clasp version "Bump the version."`

### Versions

List versions of a script.

#### Examples

- `clasp versions`

### List

Lists your most recent Apps Script projects.

#### Examples

- `clasp list # helloworld1 – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ...`

## Advanced Commands

> **NOTE**: These commands require Project ID/credentials setup (see below).

### Logs

Prints out most recent the _StackDriver logs_. These are logs from `console.log`, not `Logger.log`.

#### Options

- `--json`: Output logs in json format.
- `--open`: Open StackDriver logs in a browser.
- `--watch`: Retrieves the newest logs every 5 seconds.

#### Examples

```
clasp logs
ERROR Sat Apr 07 2019 10:58:31 GMT-0700 (PDT) myFunction      my log error
INFO  Sat Apr 07 2019 10:58:31 GMT-0700 (PDT) myFunction      info message
```

- `clasp logs --json`
- `clasp logs --open`
- `clasp logs --watch`

### Run

Remotely executes an Apps Script function.

To use this command you must:
1. Log in with your credentials (`clasp login --creds creds.json`)
1. Deploy the Script as an API executable (Easist done via GUI at the moment).
1. Enable any APIs that are used by the script.

#### Options

- `functionName`: The name of the function in the script that you want to run.
- `nondev`: If true, runs the function in non-devMode.

#### Examples

- `clasp run 'sendEmail'`

### List/Enable/Disable Google APIs

List available APIs. Enables and disables Google APIs.

#### List APIs

Lists Google APIs that can be enabled as [Advanced Services](https://developers.google.com/apps-script/guides/services/advanced).

- `clasp apis`
- `clasp apis list`

#### Enable/Disable APIs

Enables or disables APIs with the Google Cloud project. These APIs are used via services like GmailApp and Advanced Services like BigQuery.

The API name can be found using `clasp apis list`.

- `clasp apis enable drive`
- `clasp apis disable drive`

### Help

Displays the help function.

#### Examples

- `clasp help`

### Setting

Update `.clasp.json` settings file.
If `newValue` is omitted it returns the current setting value

#### Options

- `settingKey`: settingKey They key in `.clasp.json` you want to change
- `newValue`: newValue The new value for the setting

#### Examples

- `clasp setting scriptId`
- `clasp setting scriptId new-id`

## Guides

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
  "projectId": "project-id-xxxxxxxxxxxxxxxxxxx",
  "fileExtension": "ts",
  "filePushOrder": ["file1.ts", "file2.ts"]
}
```

The following configuration values can be used:

### `scriptId` (required)

Specifies the id of the Google Script project that clasp will target. It is the part located inbetween `/d/` and `/edit` in your project's URL: `https://script.google.com/d/<SCRIPT_ID>/edit`.

### `rootDir` (optional)

Specifies the **local** directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

### `projectId` (optional)

Specifies the id of the Google Cloud Platform project that clasp will target.
The Google Script project is associated with the Google Cloud Platform.

1. Run `clasp open`.
1. Click `Resources > Cloud Platform project...`.
1. Specify the project ID `project-id-xxxxxxxxxxxxxxxxxxx`.

Even if you do not set this manually, clasp will ask this via a prompt to you at the required time.

### `fileExtension` (optional)

Specifies the file extension for **local** script files in your Apps Script project.

### `filePushOrder` (optional)

Specifies the files that should be pushed first, useful for scripts that rely on order of execution. All other files are pushed after this list of files.

## Troubleshooting

The library requires **Node version >= 6.0.0**. Use this script to check your version and **upgrade Node if necessary**:

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
