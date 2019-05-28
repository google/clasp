# Clasp configuration files

A Clasp project uses the following configuration files:

File | Default | Description
--- | --- | ---
Clasp project file | `./.clasp.json` | Define which Apps Script project to interact with (and how)
Clasp ignore file | `.claspignore` in the same directory as the Clasp project file | Specifies files to ignore by `push` and `watch` Clasp commands
Google Auth file | `~/.clasprc.json` | OAuth 2.0 authentication and authorization to access Google APIs. Authentication is global by default.
Apps Script project manifest | `<rootDir>/appsscript.json` | Specifies basic project information (cf. [Manifests](https://developers.google.com/apps-script/concepts/manifests))
Typescript configuration file | `<rootDir>/tsconfig.json` | Used for user specific compiling options. Limited support.

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
