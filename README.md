# clasp

Develop [Apps Script](https://developers.google.com/apps-script/) projects locally using clasp (*C*ommand *L*ine *A*pps *S*cript *P*rojects).

### Install

First download `clasp`:

```sh
npm i @google/clasp -g
```

Then enable Apps Script API: https://script.google.com/home/usersettings

### Features

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

## Commands

```sh
clasp -h
```
- `clasp login`
- `clasp logout`
- `clasp create [scriptTitle]`
- `clasp clone <scriptId>`
- `clasp pull`
- `clasp push`
- `clasp open`
- `clasp deployments`
- `clasp deploy [version] [description]`
- `clasp redeploy <deploymentId> <description>`
- `clasp version [description]`
- `clasp versions`

## How To...

### Login/Logout
```
clasp login
clasp logout
```

### Create a New Apps Script Project

Files in the current directory are added to the project.

```
clasp create [scriptTitle]
```

### Clone an existing project in the current directory

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

### Open the project on script.google.com

```
clasp open
```

## Troubleshooting

The library requires Node version >= 4.7.4.

```sh
node -v # Check Node version
sudo npm install n -g
sudo n latest
```

## Develop

To develop the Apps Script SDK locally, install the CLI locally:

```sh
sudo npm i -g
clasp <command>
```

Bump versions and publish with:

```sh
npm publish --access public
```

⚡ Powered by the [Apps Script API](https://developers.google.com/apps-script/api/).
