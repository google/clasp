# Clasp

![build status](https://github.com/google/clasp/actions/workflows/ci.yaml/badge.svg)
<a href="https://coveralls.io/github/google/clasp?branch=master"><img src="https://coveralls.io/repos/github/google/clasp/badge.svg?branch=master" alt="Coverage Status"></a>
<a href="https://www.npmjs.com/package/@google/clasp"><img src="https://img.shields.io/npm/v/@google/clasp.svg" alt="npm Version"></a>
<a href="https://npmcharts.com/compare/@google/clasp?minimal=true"><img src="https://img.shields.io/npm/dw/@google/clasp.svg" alt="npm Downloads"></a>
<a href="https://david-dm.org/google/clasp" title="dependencies status"><img src="https://david-dm.org/google/clasp/status.svg"/></a>
<a href="https://github.com/google/gts" title="Code Style: Google"><img src="https://img.shields.io/badge/code%20style-google-blueviolet.svg"/></a>

> Develop [Apps Script](https://developers.google.com/apps-script/) projects locally using clasp (**C**ommand **L**ine **A**pps **S**cript **P**rojects).

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

You can also try clasp in Gitpod, a one-click online IDE for GitHub:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/google/clasp/blob/master/docs/Gitpod/)

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
- [And more…](docs/typescript.md)

**➡️ Run Apps Script:** Execute your Apps Script from the command line. Features:

- _Instant_ deployment.
- Suggested functions Autocomplete (Fuzzy)
- Easily add custom Google OAuth scopes
- [And more…](docs/run.md)

**- V8 support** take advantage of the performance boost of Chrome JavaScript engine:

- Every ES2019 features (except ES modules)
- Edit your `appsscript.json` manifest to choose between the **Rhino** and **V8** engines
- Typescript users should update their `tsconfig.json` with the `"target": "ES2019"` compiler option

## Install

First download `clasp`:

```sh
npm install -g @google/clasp
```

Then enable the Google Apps Script API: https://script.google.com/home/usersettings

![Enable Apps Script API](https://user-images.githubusercontent.com/744973/54870967-a9135780-4d6a-11e9-991c-9f57a508bdf0.gif)

## Commands

The following command provide basic Apps Script project management.

> Note: Most of them require you to `clasp login` and `clasp create/clone` before using the rest of the commands.

```sh
clasp
```

- [`clasp login [--no-localhost] [--creds <file>] [--status]`](#login)
- [`clasp logout`](#logout)
- [`clasp create [--title <title>] [--type <type>] [--rootDir <dir>] [--parentId <id>]`](#create)
- [`clasp clone <scriptId | scriptURL> [versionNumber] [--rootDir <dir>]`](#clone)
- [`clasp pull [--versionNumber]`](#pull)
- [`clasp push [--watch] [--force]`](#push)
- [`clasp status [--json]`](#status)
- [`clasp open [scriptId] [--webapp] [--creds] [--addon] [--deploymentId <id>]`](#open)
- [`clasp deployments`](#deployments)
- [`clasp deploy [--versionNumber <version>] [--description <description>] [--deploymentId <id>]`](#deploy)
- [`clasp undeploy [deploymentId] [--all]`](#undeploy)
- [`clasp version [description]`](#version)
- [`clasp versions`](#versions)
- [`clasp list`](#list)

### Advanced Commands

> **NOTE**: These commands require you to add your [Project ID](#projectid-optional).

- [`clasp logs [--json] [--open] [--setup] [--watch] [--simplified]`](#logs)
- [`clasp apis list`](#apis)
- [`clasp apis enable <api>`](#apis)
- [`clasp apis disable <api>`](#apis)
- [`clasp setting <key> [value]`](#setting)

#### Clasp Run

> **NOTE**: This command requires you to [bring your own Google API credentials](/docs/run.md).

- [`clasp run [functionName] [--nondev] [--params <StringArray>]`](#run)

## Reference

### Login

Logs the user in. Saves the client credentials to a `.clasprc.json` file.

#### Options

- `--no-localhost`: Do not run a local server, manually enter code instead.
- `--creds <file>`: Use custom credentials used for `clasp run`. Saves a `.clasprc.json` file to current working directory. This file should be private!
- `--status`: Print who you are currently logged in as, if anyone.

#### Examples

- `clasp login --no-localhost`
- `clasp login --creds creds.json`
- `clasp login --status`

### Logout

Logs out the user by deleting client credentials.

#### Examples

- `clasp logout`

### Create

Creates a new script project. Prompts the user for the script type if not specified.

#### Options

- `--type [docs/sheets/slides/forms]`: If specified, creates a new add-on attached to a Document, Spreadsheet, Presentation, or Form. If `--parentId` is specified, this value is ignored.
- `--title <title>`: A project title.
- `--rootDir <dir>`: Local directory in which clasp will store your project files. If not specified, clasp will default to the current directory.
- `--parentId <id>`: A project parent Id.
  - The Drive ID of a parent file that the created script project is bound to. This is usually the ID of a Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a standalone script project is created.
  - i.e. `https://docs.google.com/presentation/d/{id}/edit`

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
- `clasp create --parentId "1D_Gxyv*****************************NXO7o"`

These options can be combined like so:

- `clasp create --title "My Script" --parentId "1D_Gxyv*****************************NXO7o" --rootDir ./dist`

### Clone

Clones the script project from script.google.com.

#### Options

- `scriptId | scriptURL`: The script ID _or_ script URL to clone.
- `--versionNumber <number>`: The version of the script to clone.
- `--rootDir <dir>`: Local directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

#### Examples

- `clasp clone "15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC"`
- `clasp clone "https://script.google.com/d/15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC/edit"`
- `clasp clone "15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC" --rootDir ./src`

### Pull

Fetches a project from either a provided or saved script ID.
Updates local files with Apps Script project.

#### Options

- `--versionNumber <number>`: The version number of the project to retrieve.

#### Examples

- `clasp pull`
- `clasp pull --versionNumber 23`

### Push

Force writes all local files to script.google.com.

> Warning: Google `scripts` APIs do not currently support atomic nor per file operations. Thus the `push` command always **replaces** the whole content of the online project with the files being pushed.

Ignores files:

- That start with a `.`
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the `.claspignore` file)

#### Options

- `-f` `--force`: Forcibly overwrites the remote manifest.
- `-w` `--watch`: Watches local file changes. Pushes files every few seconds.

#### Examples

- `clasp push`
- `clasp push -f`
- `clasp push --watch`

### Status

Lists files that will be written to the server on `push`.

Ignores files:

- That start with a `.`
- That don't have an accepted file extension
- That are ignored (filename matches a glob pattern in the ignore file)

#### Options

- `--json`: Show status in JSON form.

#### Examples

- `clasp status`
- `clasp status --json`

### Open

Opens the current directory's `clasp` project on script.google.com. Provide a `scriptId` to open a different script. Can also open web apps.

#### Options

- `[scriptId]`: The optional script project to open.
- `--webapp`: Open web application in a browser.
- `--creds`: Open the URL to create credentials.
- `--addon`: List parent IDs and open the URL of the first one.
- `--deploymentId <id>`: Use custom deployment ID with `--webapp`.

#### Examples

- `clasp open`
- `clasp open "15ImUCpyi1Jsd8yF8Z6wey_7cw793CymWTLxOqwMka3P1CzE5hQun6qiC"`
- `clasp open --webapp`
- `clasp open --creds`
- `clasp open --addon`
- `clasp open --webapp --deploymentId abcd1234`

### Deployments

List deployments of a script.

#### Examples

- `clasp deployments`

### Deploy

Creates a version and deploys a script.
The response gives the deployment ID and the version of the deployment.

For web apps, each deployment has a unique URL.
To update/redeploy an existing deployment, provide the deployment ID.

#### Options

- `-V <version>` `--versionNumber <version>`: The project version to deploy at.
- `-d <description>` `--description <description>`: The deployment description.
- `-i <id>` `--deploymentId <id>`: The deployment ID to redeploy.

#### Examples

- `clasp deploy` (create new deployment and new version)
- `clasp deploy --versionNumber 4` (create new deployment)
- `clasp deploy --description "Updates sidebar logo."` (deploy with description)
- `clasp deploy --deploymentId abcd1234` (redeploy and create new version)
- `clasp deploy -V 7 -d "Updates sidebar logo." -i abdc1234`

### Undeploy

Undeploys a deployment of a script.

#### Options

- `[deploymentId]`: An optional deployment ID.
- `-a` `--all`: Undeploy all deployments.

#### Examples

- `clasp undeploy` (undeploy the last deployment.)
- `clasp undeploy "123"`
- `clasp undeploy --all`

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

- `clasp list`: Prints `helloworld1 – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ...`

## Advanced Commands

> **NOTE**: These commands require Project ID/credentials setup (see below).

### Logs

Prints out most recent the _StackDriver logs_. These are logs from `console.log`, not `Logger.log`.

#### Options

- `--json`: Output logs in json format.
- `--open`: Open StackDriver logs in a browser.
- `--setup`: Setup StackDriver logs.
- `--watch`: Retrieves the newest logs every 5 seconds.
- `--simplified`: Removes timestamps from the logs.

#### Examples

```text
clasp logs
ERROR Sat Apr 07 2019 10:58:31 GMT-0700 (PDT) myFunction      my log error
INFO  Sat Apr 07 2019 10:58:31 GMT-0700 (PDT) myFunction      info message
```

- `clasp logs --json`
- `clasp logs --open`
- `clasp logs --watch`
- `clasp logs --simplified`

### Run

Remotely executes an Apps Script function.

The complete step-by-step information on how to use `clasp run` is available here: [Run](/docs/run.md)  
Below is a short summary:

1. Log in with your credentials (`clasp login --creds creds.json`), see: [Run - Prerequisites](/docs/run.md#prerequisites)
1. Deploy the Script as an API executable (Easiest done via GUI at the moment).
1. Enable any APIs that are used by the script, see: [Run - Function with Scopes](/docs/run.md#run-a-function-that-requires-scopes)
1. Have the following in your `appsscript.json`. Be sure it's pushed:

```json
"executionApi": {
  "access": "ANYONE"
}
```

#### Options

- `<functionName>`: The name of the function in the script that you want to run.
- `--nondev`: If true, runs the function in non-devMode.
- `-p <paramString>` `--params <paramString>`: A JSON string array of parameters to pass to the function

#### Examples

- `clasp run 'sendEmail'`
- `clasp run 'addOptions' -p '["string", 123, {"test": "for"}, true]'`

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

#### Open APIs Console

Open the Google Cloud Console where you can view and manage API access.

- `clasp apis --open`

### Help

Displays the help function.

#### Examples

- `clasp`
- `clasp help`

### Setting

Update `.clasp.json` settings file.

If `settingKey` is omitted it prints the current settings.
If `newValue` is omitted it returns the current setting value.

#### Options

- `settingKey`: settingKey They key in `.clasp.json` you want to change
- `newValue`: newValue The new value for the setting

#### Examples

- `clasp setting`
- `clasp setting scriptId`
- `clasp setting scriptId new-id`

## Guides

### Ignore File (`.claspignore`)

Like `.gitignore`, `.claspignore` allows you to ignore files that you do not wish to not upload on `clasp push`. Steps:

1. Create a file called `.claspignore` in your project's root directory.
1. Add patterns to be excluded from `clasp push`. _Note_: The `.claspignore` patterns are applied by [multimatch](https://github.com/sindresorhus/multimatch), which is different from `.gitignore`, especially for directories. To ignore a directory, use syntax like `**/node_modules/**`.

A sample `.claspignore` ignoring everything except the manifest and `build/main.js`:

```text
**/**
!build/main.js
!appsscript.json
```

_Note_: The `.claspignore` patterns are applied relative from the `rootDir`.

If no `.claspignore` is specified, a default set of patterns is applied. This default set will only consider the `appsscript.json` manifest and any JavaScript, TypeScript and `.html` source files within the `rootDir` folder. Child folders other than `.git` and `node_modules` are processed.

```text
# ignore all files…
**/**

# except the extensions…
!appsscript.json
!**/*.gs
!**/*.js
!**/*.ts
!**/*.html

# ignore even valid files if in…
.git/**
node_modules/**
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

Specifies the id of the Google Script project that clasp will target. 

1. Open script url.
1. File > Project properties > Script ID


### `rootDir` (optional)

Specifies the **local** directory in which clasp will store your project files. If not specified, clasp will default to the current directory.

### `projectId` (optional)

Specifies the id of the Google Cloud Platform project that clasp will target.
You must [associate Google Script project with Google Cloud Platform](https://github.com/google/clasp/blob/master/docs/run.md#setup-instructions) beforehand.

1. Run `clasp open`.
1. Click `Resources > Cloud Platform project...`.
1. Specify the project ID `project-id-xxxxxxxxxxxxxxxxxxx`.

Even if you do not set this manually, clasp will ask this via a prompt to you at the required time.

### `fileExtension` (optional)

Specifies the file extension for **local** script files in your Apps Script project.

### `filePushOrder` (optional)

Specifies the files that should be pushed first, useful for scripts that rely on order of execution. All other files are pushed after this list of files.

## Troubleshooting

### NodeJS Version

The library requires **NodeJS version >= 10.3.0**.

You can check your version of NodeJS with this command.

```sh
node -v
```

You can use these commands to upgrade NodeJS if necessary (**not on Windows**):

```sh
npm install -g npm # Update npm and npx
npx n latest # use the n package to update node
```

### Using a Proxy

Clasp supports proxies via the Google APIs Node Module.
See ["Using a Proxy"](https://github.com/googleapis/google-api-nodejs-client#using-a-proxy) and [this discussion](https://github.com/google/clasp/issues/8#issuecomment-427560737) for details on how to use the proxy.
This requires using the environment variables `HTTP_PROXY` / `HTTPS_PROXY`.

## README Badge

Using clasp for your project? Add a README badge to show it off: [![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg)](https://github.com/google/clasp)

```md
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
1. Run [gts linter](https://github.com/google/gts): `npm run lint`.
1. Submit a pull request after testing your feature to make sure it works.

⚡ Powered by the [Apps Script API](https://developers.google.com/apps-script/api/).
