# Clasp configuration files

A Clasp project uses the following configuration files:

File | Default | Description
--- | --- | ---
Clasp project file | `./.clasp.json` | Specifies which Apps Script project to interact with (and how)
Clasp ignore file | `.claspignore` in the same directory as the Clasp project file | Specifies files are ignored by `push` and `watch` commands
Google Auth file | `~/.clasprc.json` (global) or `.clasprc.json` in the same directory as the Clasp project file (local) | OAuth 2.0 authentication and authorization to access Google APIs. Authentication is global by default.
Apps Script project manifest | `<rootDir>/appsscript.json` | Specifies basic project information (cf. [Manifests](https://developers.google.com/apps-script/concepts/manifests))
Typescript configuration file | `<rootDir>/tsconfig.json` | Used for user specific compiling options (limited support.)

## Environment variables

Environment variables can be set in order to specify the location of the following configutation files:

File | Environment varaiable | Comment
--- | --- | ---
Clasp project file | `clasp_config_project` | The filename must start with a dot '.'
Clasp ignore file | `clasp_config_ignore` |
Google Auth file | `clasp_config_auth` | The filename must start with a dot '.'

## Command line options

Command line options can be used in order to specify the location of the following configutation files:

File | Environment varaiable | Comment
--- | --- | ---
Clasp project file | `-P <path>` or `--project <path>` | The filename must start with a dot '.'
Clasp ignore file | `-I <path>` or `--ignore <path>` |
Google Auth file | `-A <path>` or `--auth <path>` | The filename must start with a dot '.'

> Note: command line options have precedence over environment variables

## Usage of configuration files per command

Command | Project file | ignore file | Auth file | Manifest file
--- | --- | --- | --- | ---
login | | | Write (`--creds` option) |
logout | | | Delete |
create | Write | | Read | Write
clone | Write | | Read | Write
pull | Read | | Read | Write
push | Read | Read | Read | Read
status | Read | Read | | Read
open | Read | | Read | ???
deployments | Read | | Read | ???
deploy | Read | | Read | Read
undeploy | Read | | Read | ???
version | Read | | Read | ???
versions | Read | | Read | ???
list | | | Read |
logs | ??? | | Read | ???
run | Read | | Read | ???
apis | ??? | | Read | ???
setting | Read | | ??? | ???
