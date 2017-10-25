# gasp

➡ Develop [Apps Script](https://developers.google.com/apps-script/) projects locally.

```sh
npm i @google/gasp -g
```

<INSERT GIF HERE>

### Features
**🗺️ Develop Locally:** `gasp` allows you to develop your Apps Script projects locally. That means you can check-in your code into source control, collaborate with other developers, and use your favorite tools to develop Apps Script.

**🔢 Manage Deployment Versions:** Create, update, and view your multiple deployments of your project.

**📁 Structure Code:** `gasp` automatically converts your flat project on [script.google.com](script.google.com) into **folders**. For example:
- _On script.google.com_:
  - `tests/slides.gs`
  - `tests/sheets.gs`
- _locally_:
  - `tests/`
    - `slides.js`
    - `sheets.js`

## Commands

```sh
gasp
```
- `gasp login`
- `gasp logout`
- `gasp create [scriptTitle]`
- `gasp clone <scriptId>`
- `gasp pull`
- `gasp push`
- `gasp open`
- `gasp deployments`
- `gasp deploy [version] [description]`
- `gasp redeploy <deploymentId> <description>`
- `gasp version [description]`
- `gasp versions`

## How To...

### Login/Logout
```
gasp login
gasp logout
```

### Create a New Apps Script Project

Files in the current directory are added to the project.

```
gasp create [scriptTitle]
```

### Clone an existing project in the current directory

```
gasp clone <scriptId>
```

### Push/Pull

```
gasp push # Updates Apps Script project with local files
gasp pull # Updates local files with Apps Script project
```

### Update a Published Project / Deploy

To deploy a project:

1. Create an immutable version of the Apps Script project using `gasp version`
1. Deploy the version using `gasp deploy [version]`

```
gasp versions # List versions
gasp version [description] # Create a new version with a description
```

then deploy...

```
gasp deploy [version] [description]
gasp undeploy <deploymentId>
gasp deployments # List all deployment IDs
```

### Open the project on script.google.com

```
gasp open
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
gasp <command>
```

⚡ Powered by the [Apps Script API](https://developers.google.com/apps-script/dogfood/scriptmanagement/reference/).
