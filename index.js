#!/usr/bin/env node
/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The Apps Script CLI
 */
const anymatch = require('anymatch');
const connect = require('connect');
const del = require('del');
const dotf = require('dotf');
const findParentDir = require('find-parent-dir');
const fs = require('fs');
const google = require('googleapis');
const http = require('http');
const mkdirp = require('mkdirp');
const OAuth2 = google.auth.OAuth2;
const open = require('open');
const os = require('os');
const path = require('path');
const pluralize = require('pluralize');
const program = require('commander');
const read = require('read-file');
const readMultipleFiles = require('read-multiple-files');
const recursive = require('recursive-readdir');
const Spinner = require('cli-spinner').Spinner;
const splitLines = require('split-lines');
const url = require('url');

// Debug
const DEBUG = false;

// Names / Paths
const PROJECT_NAME = 'clasp';
const PROJECT_MANIFEST_BASENAME = 'appsscript';
const PROJECT_MANIFEST_FULLNAME = `${PROJECT_MANIFEST_BASENAME}.json`;

// Dotfile names
const DOT = {
  IGNORE: { // Ignores files on `push`
    DIR: '~',
    NAME: `${PROJECT_NAME}ignore`,
    PATH: `.${PROJECT_NAME}ignore`,
  },
  PROJECT: { // Saves project information, local to project directory
    DIR: './', // Relative to where the command is run. See DOTFILE.PROJECT()
    NAME: `${PROJECT_NAME}.json`,
    PATH: `.${PROJECT_NAME}.json`,
  },
  RC: { // Saves global information, in the $HOME directory
    DIR: '~',
    NAME: `${PROJECT_NAME}rc.json`,
    PATH: `~/.${PROJECT_NAME}rc.json`,
    ABSOLUTE_PATH: path.join(os.homedir(), `.${PROJECT_NAME}rc.json`)
  },
};

// Dotfile files
const DOTFILE = {
  /**
   * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
   * @return {string[]} A list of file glob patterns
   */
  IGNORE: () => {
    let projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    let path = `${projectDirectory}/${DOT.IGNORE.PATH}`;
    return new Promise((res, rej) => {
      if (fs.existsSync(path)) {
        let buffer = read.sync(DOT.IGNORE.PATH, 'utf8');
        res(splitLines(buffer).filter(name => name));
      } else {
        res([]);
      }
    });
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    let projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    return dotf(projectDirectory, DOT.PROJECT.NAME);
  },
  // See `login`: Stores { accessToken, refreshToken }
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
};

// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_PORT = 2020;
const oauth2Client = new OAuth2(
    '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com', // CLIENT_ID
    'v6V3fKV_zWU7iw1DrpO1rknX', // CLIENT_SECRET
    'http://localhost:' + REDIRECT_PORT
    // 'urn:ietf:wg:oauth:2.0:oob' // REDIRECT_URI (@see OAuth2InstalledApp)
);
const script = google.script({
  version: 'v1',
  auth: oauth2Client
});

// Log messages (some logs take required params)
const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page.`, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Saved the credentials to ${DOT.RC.PATH}. You may close the page.`,
  AUTHORIZE: (authUrl) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId) => `Created new script: ${getScriptURL(scriptId)}.`,
  CREATE_PROJECT_START: (title) => `Creating new script: ${title}...`,
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId) => `Listing deployments for ${scriptId}...`,
  DEPLOYMENT_START: (scriptId) => `Deploying project ${scriptId}...`,
  OPEN_PROJECT: (scriptId) => `Opening script: ${scriptId}`,
  PULLING: 'Pulling files...',
  PUSH_SUCCESS: (numFiles) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  UNDEPLOYMENT_FINISH: (deploymentId) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId) => `Undeploy ${deploymentId}...`,
  UNTITLED_SCRIPT_TITLE: 'Untitled Script',
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }) => `${versionNumber} - ${description || '(no description)'}`,
  VERSION_NUM: (numVersions) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
};

// Error messages (some errors take required params)
const ERROR = {
  ACCESS_TOKEN: `Error retrieving access token: `,
  COMMAND_DNE: (command) => `🤔  Unknown command "${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
  CREATE: 'Error creating script.',
  DEPLOYMENT_COUNT: `Unable to deploy; Only one deployment can be created at a time`,
  FOLDER_EXISTS: `Project file (${DOT.PROJECT.PATH}) already exists.`,
  FS_DIR_WRITE: 'Could not create directory.',
  FS_FILE_WRITE: 'Could not write file.',
  LOGGED_IN: `You seem to already be logged in. Did you mean to 'logout'?`,
  LOGGED_OUT: `Please login. (${PROJECT_NAME} login)`,
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
  PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:
https://script.google.com/home/usersettings`,
  SCRIPT_ID: '\n> Did you provide the correct scriptId?\n',
  SCRIPT_ID_DNE: `No ${DOT.PROJECT.PATH} settings found. \`create\` or \`clone\` a project first.`,
  SCRIPT_ID_INCORRECT: (scriptId) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
  UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
};

// Utils
const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {Object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
const logError = (err, description) => {
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    console.error(JSON.parse(err.error).error);
  } else if (err && err.statusCode === 401 || err && err.error && err.error.error && err.error.error.code === 401) {
    console.error(ERROR.UNAUTHENTICATED);
  } else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
    console.error(ERROR.PERMISSION_DENIED);
  } else {
    if (err && err.error) {
      console.error(`~~ API ERROR (${err.statusCode || err.error.code})`);
      console.error(err.error);
    }
    if (description) console.error(description);
  }
};

/**
 * Gets the script URL from a script ID.
 *
 * It is too expensive to get the script URL from the Drive API. (Async/not offline)
 * @param  {String} scriptId The script ID
 * @return {String}          The URL of the script in the online script editor.
 */
const getScriptURL = (scriptId) => `https://script.google.com/d/${scriptId}/edit`;

/**
 * Gets the project settings from the project dotfile. Logs errors.
 * Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise} A promise to get the project script ID.
 */
function getProjectSettings() {
  return new Promise((resolve, reject) => {
    let fail = () => {
      logError(null, ERROR.SCRIPT_ID_DNE);
      reject();
    };
    let dotfile = DOTFILE.PROJECT();
    if (dotfile) {
      // Found a dotfile, but does it have the settings, or is it corrupted?
      dotfile.read().then((settings) => {
        // Settings must have the script ID. Otherwise we err.
        if (settings.scriptId) {
          resolve(settings.scriptId);
        } else {
          fail();
        }
      }).catch((err) => {
        fail();
      });
    } else {
      fail(); // Never found a dotfile
    }
  }).catch(err => {
    spinner.stop(true);
  });
}

/**
 * Gets the Apps Script API credentials for the CLI.
 * Required before every API call.
 * @param {Function} cb The callback
 */
function getAPICredentials(cb) {
  DOTFILE.RC.read().then((rc) => {
    oauth2Client.credentials = rc;
    cb(rc);
  }).catch((err) => {
    logError(null, ERROR.LOGGED_OUT);
  });
}

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 */
function getFileType(type) {
  return {
    SERVER_JS: 'gs',
    SHARED_JS: 'gs'
  }[type] || type.toLowerCase();
}

/**
 * Gets the API FileType. Assumes the path is valid.
 * @param  {string} path The file path
 * @return {string}      The API's FileType enum (uppercase), null if not valid.
 */
function getAPIFileType(path) {
  let extension = path.substr(path.lastIndexOf('.') + 1).toUpperCase();
  return {
    GS: 'SERVER_JS',
    HTML: 'HTML',
    JSON: 'JSON'
  }[extension];
}

/**
 * Saves the script ID in the project dotfile.
 * @param  {string} scriptId The script ID
 */
function saveProjectId(scriptId) {
  DOTFILE.PROJECT().write({ scriptId }); // Save the script id
}

/**
 * Checks if the current directory appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
function manifestExists() {
  return fs.existsSync(PROJECT_MANIFEST_FULLNAME);
}

// CLI

/**
 * Set global CLI configurations
 */
program
  .usage('<command> [options]')
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

/**
 * Logs the user in. Saves the client credentials to an rc file.
 */
program
  .command('login')
  .description('Log in to script.google.com')
  .action(() => {
    // Try to read the RC file.
    DOTFILE.RC.read().then((rc) => {
      console.warn(ERROR.LOGGED_IN);
    }).catch((err) => {
      var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/script.deployments',
          'https://www.googleapis.com/auth/script.projects',
        ],
      });
      console.log(LOG.AUTHORIZE(authUrl));
      open(authUrl);

      // Create a local HTTP server that reads the OAuth token
      var app = connect();
      app.use(function(req, res) {
        var url_parts = url.parse(req.url, true);
        var code = url_parts.query.code;
        if (url_parts.query.code) {
          oauth2Client.getToken(code, (err, token) => {
            if (err) return console.error(ERROR.ACCESS_TOKEN + err);
            DOTFILE.RC.write(token).then(() => {
              // Kill the CLI after DOTFILE write
              console.log(LOG.AUTH_SUCCESSFUL);
              process.exit(0);
            });
          });
        }
        res.end(LOG.AUTH_PAGE_SUCCESSFUL);
      });
      http.createServer(app)
          .listen(REDIRECT_PORT);
    });
  });

/**
 * Logs out the user by deleteing client credentials.
 */
program
  .command('logout')
  .description('Log out')
  .action(() => {
    del(DOT.RC.ABSOLUTE_PATH, { force: true }); // del doesn't work with a relative path (~)
  });

/**
 * Creates a new script project. The project title is optional.
 * @example `create "My Script"`
 */
program
  .command('create [scriptTitle]')
  .description('Create a script')
  .action((title = LOG.UNTITLED_SCRIPT_TITLE) => {
    if (fs.existsSync(DOT.PROJECT.PATH)) {
      logError(null, ERROR.FOLDER_EXISTS);
    } else {
      getAPICredentials(() => {
        spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title));
        spinner.start();
        script.projects.create({ title }, {}, (error, res) => {
          spinner.stop(true);
          if (error) {
            logError(error, ERROR.CREATE);
          } else {
            var scriptId = res.scriptId;
            console.log(LOG.CREATE_PROJECT_FINISH(scriptId));
            saveProjectId(scriptId)
            if (!manifestExists()) {
              fetchProject(scriptId); // fetches appsscript.json, o.w. `push` breaks
            }
          }
        });
      });
    }
  });

/**
 * Fetches the files for a project from the server and writes files locally to
 * `pwd` with dots converted to subdirectories.
 * @param {string} scriptId The project script id
 */
function fetchProject(scriptId) {
  spinner.start();
  getAPICredentials(() => {
    script.projects.getContent({
      scriptId,
    }, {}, (error, res) => {
      spinner.stop(true);
      if (error) {
        if (error.statusCode === 404) {
          logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        } else {
          logError(error, ERROR.SCRIPT_ID);
        }
      } else {
        if (!res.files) {
          return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        }
        // Create the files in the cwd
        console.log(LOG.CLONE_SUCCESS(res.files.length));
        let sortedFiles = res.files.sort((file) => file.name);
        sortedFiles.map((file) => {
          let filePath = `${file.name}.${getFileType(file.type)}`;
          let truePath = `./${filePath}`;
          mkdirp(path.dirname(truePath), (err) => {
            if (err) return logError(err, ERROR.FS_DIR_WRITE);
            fs.writeFile(`./${filePath}`, file.source, (err) => {
              if (err) return logError(err, ERROR.FS_FILE_WRITE);
            });
            console.log(`└─ ${filePath}`);
          });
        });
      }
    });
  });
}

/**
 * Fetches a project and saves the script id locally.
 */
program
  .command('clone <scriptId>')
  .description('Clone a project')
  .action((scriptId) => {
    spinner.setSpinnerTitle(LOG.CLONING);
    saveProjectId(scriptId)
    fetchProject(scriptId);
  });

/**
 * Fetches a project from either a provided or saved script id.
 */
program
  .command('pull')
  .description('Fetch a remote project')
  .action(() => {
    getProjectSettings().then((scriptId) => {
      if (scriptId) {
        spinner.setSpinnerTitle(LOG.PULLING);
        fetchProject(scriptId);
      }
    });
  });

/**
 * Force writes all local files to the script management server.
 * Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 */
program
  .command('push')
  .description('Update the remote project')
  .action(() => {
    spinner.setSpinnerTitle(LOG.PUSHING);
    spinner.start();
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        if (!scriptId) return;
        // Read all filenames as a flattened tree
        recursive(`./`, (err, filePaths) => {
          if (err) return logError(err);
          // Filter files that aren't allowed.
          filePaths = filePaths.filter((name) => !name.startsWith('.'));
          DOTFILE.IGNORE().then((ignorePatterns) => {
            filePaths = filePaths.sort(); // Sort files alphanumerically

            // Match the files with ignored glob pattern
            readMultipleFiles(filePaths, 'utf8', (err, contents) => {
              if (err) return console.error(err);
              let nonIgnoredFilePaths = [];
              let files = filePaths.map((name, i) => {
                let nameWithoutExt = name.slice(0, -path.extname(name).length);
                if (getAPIFileType(name) && !anymatch(ignorePatterns, name)) {
                  nonIgnoredFilePaths.push(name);
                  return {
                    name: nameWithoutExt, // the API separates the extension
                    type: getAPIFileType(name), // the file
                    source: contents[i]
                  };
                } else {
                  return; // Skip ignored files
                }
              }).filter(Boolean); // remove null values

              script.projects.updateContent({
                scriptId,
                resource: { files }
              }, {}, (error, res) => {
                spinner.stop(true);
                if (error) {
                  console.error(LOG.PUSH_FAILURE);
                  error.errors.map(err => {
                    console.error(err.message);
                  });
                } else {
                  nonIgnoredFilePaths.map((filePath) => {
                    console.log(`└─ ${filePath}`);
                  })
                  console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
                }
              });
            });
          });
        });
      });
    });
  });

/**
 * Opens the script editor in the user's browser.
 */
program
  .command('open')
  .description('Open a script')
  .action((scriptId) => {
    getProjectSettings().then((scriptId) => {
      if (scriptId) {
        console.log(LOG.OPEN_PROJECT(scriptId));
        if (scriptId.length < 30) {
          logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        } else {
          open(getScriptURL(scriptId));
        }
      }
    });
  });

/**
 * List deployments of a script
 */
program
  .command('deployments')
  .description('List deployment ids of a script')
  .action(() => {
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId));
        spinner.start();

        script.projects.deployments.list({
          scriptId
        }, {}, (error, { deployments }) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            let numDeployments = deployments.length;
            let deploymentWord = pluralize('Deployment', numDeployments);
            console.log(`${numDeployments} ${deploymentWord}.`);
            deployments.map(({ deploymentId, deploymentConfig }) => {
              let versionString = !!deploymentConfig.versionNumber ?
                  `@${deploymentConfig.versionNumber}` : '@HEAD';
              let description = deploymentConfig.description ?
                  '- ' + deploymentConfig.description:  '';
              console.log(`- ${deploymentId} ${versionString} ${description}`);
            });
          }
        });
      });
    });
  });

/**
 * Creates a version and deploys a script.
 * The response gives the version of the deployment.
 */
program
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action((version, description) => {
    description = description || '';
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId));
        spinner.start();

        function createDeployment(versionNumber) {
          spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
          script.projects.deployments.create({
            scriptId,
            resource: {
              versionNumber,
              manifestFileName: PROJECT_MANIFEST_BASENAME,
              description,
            }
          }, {}, (err, res) => {
            spinner.stop(true);
            if (err) {
              console.error(ERROR.DEPLOYMENT_COUNT);
            } else {
              console.log(`- ${res.deploymentId} @${versionNumber}.`)
            }
          });
        }

        // If the version is specified, update that deployment
        let versionRequestBody = {
          description
        };
        if (version) {
          createDeployment(+version);
        } else { // if no version, create a new version and deploy that
          script.projects.versions.create({
            scriptId,
            resource: versionRequestBody
          }, {}, (err, res) => {
            spinner.stop(true);
            if (err) {
              logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
            } else {
              console.log(LOG.VERSION_CREATED(res.versionNumber));
              createDeployment(+res.versionNumber);
            }
          });
        }
      });
    });
  });

/**
 * Undeploys a deployment of a script.
 * @example "undeploy 123"
 */
program
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action((deploymentId) => {
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId));
        spinner.start();

        script.projects.deployments.delete({
          scriptId,
          deploymentId,
        }, {}, (err, res) => {
          spinner.stop(true);
          if (err) {
            logError(null, ERROR.READ_ONLY_DELETE);
          } else {
            console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId))
          }
        });
      });
    });
  });

/**
 * Updates deployments of a script
 */
program
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action((deploymentId, version, description) => {
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        script.projects.deployments.update({
          scriptId,
          deploymentId,
          resource: {
            deploymentConfig: {
              versionNumber: version,
              manifestFileName: PROJECT_MANIFEST_BASENAME,
              description
            }
          }
        }, {}, (error, res) => {
          spinner.stop(true);
          if (error) {
            logError(null, error); // TODO prettier error
          } else {
            console.log(LOG.REDEPLOY_END);
          }
        });
      });
    });
  });

/**
 * List versions of a script
 */
program
  .command('versions')
  .description('List versions of a script')
  .action(() => {
    spinner.setSpinnerTitle('Grabbing versions...');
    spinner.start();
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        script.projects.versions.list({
          scriptId,
        }, {}, (error, res) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            if (res && res.versions && res.versions.length) {
              let numVersions = res.versions.length;
              console.log(LOG.VERSION_NUM(numVersions));
              res.versions.map((version) => {
                console.log(LOG.VERSION_DESCRIPTION(version));
              });
            } else {
              console.error(LOG.DEPLOYMENT_DNE);
            }
          }
        });
      });
    });
  });

/**
 * Creates an immutable version of the script
 */
program
  .command('version [description]')
  .description('Creates an immutable version of the script')
  .action((description) => {
    spinner.setSpinnerTitle(LOG.VERSION_CREATE);
    spinner.start();
    getAPICredentials(() => {
      getProjectSettings().then((scriptId) => {
        script.projects.versions.create({
          scriptId,
          description,
        }, {}, (error, res) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            console.log(LOG.VERSION_CREATED(res.versionNumber));
          }
        });
      }).catch((err) => {
        spinner.stop(true);
        logError(err);
      });
    });
  });

/**
 * All other commands are given a help message.
 */
program
  .command('*', { isDefault: true })
  .action((command) => {
    console.error(ERROR.COMMAND_DNE(command));
  });

// User input is provided from the process' arguments
program.parse(process.argv);
