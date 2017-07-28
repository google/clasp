#!/usr/bin/env node

/**
 * A CLI for Managing Apps Scripts
 */
const anymatch = require('anymatch');
const del = require('del');
const dirname = require('path').dirname;
const dotf = require('dotf');
const findParentDir = require('find-parent-dir');
const fs = require('fs');
const google = require('googleapis');
const mkdirp = require('mkdirp');
const OAuth2 = google.auth.OAuth2;
const os = require('os');
const openurl = require('openurl');
const parser = require('gitignore-parser');
const path = require('path');
const pluralize = require('pluralize');
const program = require('commander');
const read = require('read-file');
const readline = require('readline');
const readMultipleFiles = require('read-multiple-files');
const recursive = require('recursive-readdir');
const rp = require('request-promise');
const Spinner = require('cli-spinner').Spinner;
const splitLines = require('split-lines');

// Debug
const DEBUG = false;

// Names / Paths
const PROJECT_NAME = 'gasp';
const PROJECT_MANIFEST_BASENAME = 'appsscript';
const API_URL = `https://scriptmanagement.googleapis.com/v1/projects`;

// Dotfile names
const DOT = {
  IGNORE: { // Ignores files on `push`
    DIR: '~',
    NAME: `${PROJECT_NAME}ignore`,
    PATH: `.${PROJECT_NAME}ignore`,
  },
  PROJECT: { // Saves project information, local to project directory
    // DIR is relative to where the command is run. See DOTFILE.PROJECT()
    DIR: './',
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
    let projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH);
    let path = `${projectDirectory}/${DOT.IGNORE.PATH}`;
    return new Promise((res, rej) => {
      if (fs.existsSync(path)) {
        let buffer = read.sync(DOT.IGNORE.PATH, 'utf8');
        let lines = splitLines(buffer).filter(name => name); // an array of non-empty strings
        res(lines);
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
    let projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH);
    if (!projectDirectory) {
      return dotf(DOT.PROJECT.DIR, DOT.PROJECT.NAME);
    } else {
      return dotf(projectDirectory, DOT.PROJECT.NAME);
    }
  },
  // See `login`: Stores { accessToken, refreshToken }
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
};

// CLI / misc. settings
// @see https://developers.google.com/oauthplayground/
// CLIENT_ID: owned by timmerman@
const CLIENT_ID = '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com';
const CLIENT_SECRET = 'v6V3fKV_zWU7iw1DrpO1rknX';
// @see https://developers.google.com/identity/protocols/OAuth2InstalledApp
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Log messages (some logs take required params)
const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_SUCCESSFUL: `Saved the credentials to ${DOT.RC.PATH}.`,
  AUTHORIZE: (authUrl) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId) => `\nCreated new script: ${getScriptURL(scriptId)}.`,
  CREATE_PROJECT_START: (title) => `Creating new script: ${title}...`,
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId) => `Listing deployments for ${scriptId}...`,
  DEPLOYMENT_START: (scriptId) => `Deploying project ${scriptId}...`,
  OPEN_PROJECT: (scriptId) => `Opening script: ${scriptId}`,
  PULLING: 'Pulling files...',
  PUSH_SUCCESS: (numFiles) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  UNDEPLOYMENT_FINISH: (deploymentId) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId) => `Undeploy ${deploymentId}...`,
  UNTITLED_SCRIPT_TITLE: 'Untitled Script',
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({versionNumber, description}) => `${versionNumber} - ${description || '(no description)'}`,
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
  LOGGED_IN: `You seem to already be logged in. Did you mean to 'logout'?`,
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  ONE_DEPLOYMENT_DELETE: 'Unable to delete read-only deployment.',
  PERMISSION_DENIED: 'Error, permission denied: You do not have access to this script.',
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
  } else if (err && err.error && err.error.error && err.error.error.code === 403) {
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
 * It is too expensive to get the script URL from the drive API.
 * (Drive API is async, requires connectivity)
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
      // Never found a dotfile
      fail();
    }
  }).catch(err => {
    spinner.stop(true);
  });
}

// TODO(timmerman) Use a client library for making these requests.
// I assume we mean this library:
// https://github.com/google/google-api-nodejs-client
/**
 * Creates a request to the script manager.
 * @param  {string} path   The subpath of the request.
 * @param  {string} method The HTTP method
 * @param  {Object} json   The JSON payload to add to the request
 * @return {Promise}       A HTTP promise
 */
const req = (path, method, json) => new Promise((resolve, reject) => {
  if (DEBUG) {
    console.log(API_URL + path)
    console.log(method)
    console.log(json)
  }
  // Load the credentials every request.
  DOTFILE.RC.read().then((rc) => {
    oauth2Client.setCredentials(rc);
    rp({
      url: API_URL + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rc.access_token}`,
      },
      json,
    }).then(resolve)
      .catch((res) => {
        spinner.stop(true);
        // TODO Standardize 401 errors
        if (res.statusCode === 401 || (res.error && res.error.error && res.error.error.code === 401)) {
          /**
           * Refreshes the access token using the stored refresh token.
           * @param {function} [cb] An optional callback.
           */
          function refreshAccessToken(cb) {
            // Read the old tokens from the dotfile and load them in the oAuthClient
            DOTFILE.RC.read().then((oldTokens) => {
              oauth2Client.refreshAccessToken((err, newTokens) => {
                if (err) return console.error(err);
                let p = DOTFILE.RC.write(newTokens);
                if (cb) p.then(cb);
              });
            });
          }

          refreshAccessToken(() => {
            req(path, method, json).then(resolve).catch(reject);
          });
        } else if (res.error && res.error.error) {
          logError(res.error);
        }
      });
  }).catch((err) => {
    logError(null, ERROR.UNAUTHENTICATED);
    reject();
  });
});

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

// CLI

/**
 * Set global CLI configurations
 */
program
  .usage('<command> [options]')
  .description(`${PROJECT_NAME} - The Apps Script SDK`);

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
      /**
       * Get the new access token.
       * If we have a refresh token, we will use that.
       * Otherwise we will prompt the user for authorization.
       *
       * @param {String} [refreshToken] The optional refresh token.
       * @param {function} [cb]         The optional callback.
       * @see https://github.com/google/google-api-nodejs-client
       */
      const requestAuthorization = (refreshToken, cb) => {
        var authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/script.management'],
        });
        console.log(LOG.AUTHORIZE(authUrl));
        openurl.open(authUrl);
        var rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question(LOG.AUTH_CODE, (code) => {
          rl.close();
          oauth2Client.getToken(code, (err, token) => {
            if (err) return console.error(ERROR.ACCESS_TOKEN + err);
            console.log(LOG.AUTH_SUCCESSFUL);
            cb(token);
          });
        });
      }

      requestAuthorization(null, (tokens) => {
        DOTFILE.RC.write(tokens);
        console.log(LOG.AUTH_SUCCESSFUL);
      });
    });
  });

/**
 * Logs out the user by deleteing client credentials.
 */
program
  .command('logout')
  .description('Log out')
  .action(() => {
    del(DOT.RC.ABSOLUTE_PATH, {force: true}); // del doesn't work with a relative path (~)
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
      spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title));
      spinner.start();
      req('', 'POST', {title}).then(({scriptId}) => {
        spinner.stop(true);
        console.log(LOG.CREATE_PROJECT_FINISH(scriptId));
        fetchProject(scriptId); // fetches appsscript.json, o.w. `push` breaks
      }).catch((err) => {
        spinner.stop(true);
        logError(err, ERROR.CREATE);
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
  req(`/${scriptId}/content`, 'GET').then((res) => {
    spinner.stop(true);
    DOTFILE.PROJECT().write({scriptId}); // Save the script id

    // Create the files in the cwd
    const json = JSON.parse(res);
    console.log(LOG.CLONE_SUCCESS(json.files.length));
    let sortedFiles = json.files.sort((file) => file.name);
    sortedFiles.map((file) => {
      let filePath = `${file.name}.${getFileType(file.type)}`;
      let truePath = `./${filePath}`;
      mkdirp(dirname(truePath), (err) => {
        if (err) return logError(err, ERROR.FS_DIR_WRITE);
        fs.writeFile(`./${filePath}`, file.source, console.err);
        console.log(`└─ ${filePath}`);
      });
    });
  }).catch((err) => {
    spinner.stop(true);
    if (err.statusCode === 404) {
      logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    } else {
      logError(err, ERROR.SCRIPT_ID);
    }
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
    getProjectSettings().then((scriptId) => {
      if (!scriptId) return;
      // Read all filenames as a flattened tree
      recursive(`./`, (err, filePaths) => {
        if (err) return logError(err);
        // Filter files that aren't allowed.
        filePaths = filePaths.filter((name) => !name.startsWith('.'));
        DOTFILE.IGNORE().then((ignorePatterns) => {
          // Match the files with ignored glob pattern
          readMultipleFiles(filePaths, 'utf8', (err, contents) => {
            if (err) return console.error(err);
            let nonIgnoredFilePaths = [];
            let requestBody = filePaths.map((name, i) => {
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

            req(`/${scriptId}/content`, 'PUT', {
              files: requestBody
            }).then((res) => {
              spinner.stop(true);
              nonIgnoredFilePaths.map((filePath) => {
                console.log(`└─ ${filePath}`);
              })
              console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
            }).catch(err => {
              logError(err);
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
          openurl.open(getScriptURL(scriptId));
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
    getProjectSettings().then((scriptId) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId));
      spinner.start();

      req(`/${scriptId}/deployments`, 'GET').then((res) => {
        let deployments = JSON.parse(res).deployments;
        spinner.stop(true);
        let numDeployments = deployments.length;
        let deploymentWord = pluralize('Deployment', numDeployments);
        console.log(`${numDeployments} ${deploymentWord}.`);
        deployments.map(({deploymentId, deploymentConfig}) => {
          let versionString = !!deploymentConfig.versionNumber ?
              `@${deploymentConfig.versionNumber}` : '@HEAD';
          let description = deploymentConfig.description ?
              '- ' + deploymentConfig.description:  '';
          console.log(`- ${deploymentId} ${versionString} ${description}`);
        });
      }).catch((err) => {
        spinner.stop(true);
        logError(err);
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
    getProjectSettings().then((scriptId) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId));
      spinner.start();

      function createDeployment(versionNumber) {
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
        req(`/${scriptId}/deployments`, 'POST', {
          versionNumber,
          manifestFileName: PROJECT_MANIFEST_BASENAME,
          description,
        }).then((res) => {
          spinner.stop(true);
          console.log(`- ${res.deploymentId} @${versionNumber}.`)
        }).catch((err) => {
          spinner.stop(true);
          console.error(ERROR.DEPLOYMENT_COUNT);
        });
      }

      // If the version is specified, update that deployment
      let versionRequestBody = {
        description
      };
      if (version) {
        createDeployment(+version);
      } else { // if no version, create a new version and deploy that
        req(`/${scriptId}/versions`, 'POST', versionRequestBody).then((res) => {
          spinner.stop(true);
          console.log(LOG.VERSION_CREATED(res.versionNumber));
          createDeployment(+res.versionNumber);
        }).catch((err) => {
          spinner.stop(true);
          logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
          console.log(err);
        });
      }
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
    getProjectSettings().then((scriptId) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId));
      spinner.start();

      req(`/${scriptId}/deployments/${deploymentId}`, 'DELETE').then((res) => {
        spinner.stop(true);
        console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId))
      }).catch((err) => {
        spinner.stop(true);
        logError(null, ERROR.ONE_DEPLOYMENT_DELETE);
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
    getProjectSettings().then((scriptId) => {
      if (!scriptId) return;
      console.log(`Deployment: ${deploymentId} - ${description}`);
      spinner.setSpinnerTitle(LOG.REDEPLOY_START);
      spinner.start();
      req(`/${scriptId}/deployments/${deploymentId}`, 'PUT', {
        deploymentId,
        deploymentConfig: {
          versionNumber: version,
          manifestFileName: PROJECT_MANIFEST_BASENAME,
          description,
        }
      }).then((res) => {
        spinner.stop(true);
        console.log(LOG.REDEPLOY_END);
      }).catch((err) => {
        spinner.stop(true);
        // TODO See if we can provide a more useful description.
        logError(err);
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
    getProjectSettings().then((scriptId) => {
      req(`/${scriptId}/versions`, 'GET').then((res) => {
        spinner.stop(true);
        var json = JSON.parse(res);
        if (json && json.versions && json.versions.length) {
          let numVersions = json.versions.length;
          console.log(LOG.VERSION_NUM(numVersions));
          json.versions.map((version) => {
            console.log(LOG.VERSION_DESCRIPTION(version));
          });
        } else {
          console.error(LOG.DEPLOYMENT_DNE);
        }
      }).catch((err) => {
        spinner.stop(true);
        logError(err);
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
    getProjectSettings().then((scriptId) => {
      req(`/${scriptId}/versions`, 'POST', {
        description,
      }).then((res) => {
        spinner.stop(true);
        console.log(LOG.VERSION_CREATED(res.versionNumber));
      }).catch((err) => {
        spinner.stop(true);
        logError(err);
      });
    }).catch((err) => {
      spinner.stop(true);
      logError(err);
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
