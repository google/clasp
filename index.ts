#!/usr/bin/env node
/**
 * @license
 * Copyright Google Inc.
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
 * clasp – The Apps Script CLI
 */
import * as anymatch from "anymatch";
import 'connect';
import * as del from 'del';
import * as fs from 'fs';
import { google } from 'googleapis';
import * as http from 'http';
const isOnline = require('is-online');
import * as mkdirp from 'mkdirp';
import { OAuth2Client } from 'google-auth-library';
const open = require('open');
const path = require('path');
import * as pluralize from 'pluralize';
const commander = require('commander');
const readMultipleFiles = require('read-multiple-files');
import * as recursive from 'recursive-readdir';
import * as url from 'url';
const readline = require('readline');
const logging = require('@google-cloud/logging');
const chalk = require('chalk');
const { prompt } = require('inquirer');
import { DOT, PROJECT_NAME, PROJECT_MANIFEST_BASENAME, ClaspSettings,
    ProjectSettings, DOTFILE, spinner, logError, ERROR, getScriptURL,
    getProjectSettings, getFileType } from './src/utils.js';

// An Apps Script API File
interface AppsScriptFile {
  name: string;
  type: string;
  source: string;
}

// Used to receive files tracked by current project
interface FilesCallback {
  (
    error: Error | boolean,
    result: string[][] | null,
    files: Array<AppsScriptFile | undefined> | null,
  ) : void;
}

// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const oauth2Client = new OAuth2Client({
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost',
});
const script = google.script({
  version: 'v1',
  auth: oauth2Client,
});

// Log messages (some logs take required params)
const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page.`, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Saved the credentials to ${DOT.RC.PATH}. You may close the page.`,
  AUTHORIZE: (authUrl: string) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum: number) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId: string) => `Created new script: ${getScriptURL(scriptId)}`,
  CREATE_PROJECT_START: (title: string) => `Creating new script: ${title}...`,
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments for ${scriptId}...`,
  DEPLOYMENT_START: (scriptId: string) => `Deploying project ${scriptId}...`,
  FILES_TO_PUSH: 'Files to push were:',
  FINDING_SCRIPTS: 'Finding your scripts...',
  FINDING_SCRIPTS_DNE: 'No script files found.',
  OPEN_PROJECT: (scriptId: string) => `Opening script: ${scriptId}`,
  PULLING: 'Pulling files...',
  STATUS_PUSH: 'The following files will be pushed by clasp push:',
  STATUS_IGNORE: 'Untracked files:',
  PUSH_SUCCESS: (numFiles: number) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  RENAME_FILE: (oldName: string, newName: string) => `Renamed file: ${oldName} -> ${newName}`,
  UNDEPLOYMENT_FINISH: (deploymentId: string) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId: string) => `Undeploy ${deploymentId}...`,
  UNTITLED_SCRIPT_TITLE: 'Untitled Script',
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber: string) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }: any) => `${versionNumber} - ` +
      (description || '(no description)'),
  VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
};

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 * @param {Function} cb The callback
 * @param {boolean} isLocal If we should load local API credentials for this clasp project.
 */
function getAPICredentials(cb: (rc: ClaspSettings | void) => void, isLocal?: boolean) {
  const dotfile = isLocal ? DOTFILE.RC_LOCAL : DOTFILE.RC;
  dotfile.read().then((rc: ClaspSettings) => {
    oauth2Client.setCredentials(rc);
    cb(rc);
  }).catch((err: object) => {
    console.error('Could not read API credentials. Error:');
    console.error(err);
    process.exit(-1);
  });
}

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 */
function authorize(useLocalhost: boolean, writeToOwnKey: boolean) {
  // const codes = oauth2Client.generateCodeVerifier();
  // See https://developers.google.com/identity/protocols/OAuth2InstalledApp#step1-code-verifier
  const options = {
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/script.webapp.deploy',
    ],
    // code_challenge_method: 'S256',
    // code_challenge: codes.codeChallenge,
  };
  const authCode: Promise<string> = useLocalhost ?
    authorizeWithLocalhost(options) :
    authorizeWithoutLocalhost(options);
  authCode.then((code: string) => {
    return new Promise((res: Function, rej: Function) => {
      oauth2Client.getToken(code).then((token) => res(token.tokens));
    });
  }).then((token: object) => {
    writeToOwnKey ? DOTFILE.RC_LOCAL.write(token) : DOTFILE.RC.write(token);
  })
    .then(() => console.log(LOG.AUTH_SUCCESSFUL))
    .catch((err: string) => console.error(ERROR.ACCESS_TOKEN + err));
}

/**
 * Requests authorization to manage Apps Scrpit projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 *
 * @param {Object} opts OAuth2 options TODO formalize options
 * @return {Promise} Promise resolving with the authorization code
 */
function authorizeWithLocalhost(opts: any): Promise<string> {
  return new Promise((res: Function, rej: Function) => {
    const server = http.createServer((req: http.ServerRequest, resp: http.ServerResponse) => {
      const urlParts = url.parse(req.url || '', true);
      if (urlParts.query.code) {
        res(urlParts.query.code);
      } else {
        rej(urlParts.query.error);
      }
      resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
      setTimeout(() => { // TODO Remove hack to shutdown server.
        process.exit();
      }, 1000);
    });

    server.listen(0, () => {
      oauth2Client.redirectUri = `http://localhost:${server.address().port}`;
      const authUrl = oauth2Client.generateAuthUrl(opts);
      console.log(LOG.AUTHORIZE(authUrl));
      open(authUrl);
    });
  });
}

/**
 * Requests authorization to manage Apps Scrpit projects. Requires the
 * user to manually copy/paste the authorization code. No HTTP server is
 * used.
 *
 * @param {Object} opts OAuth2 options
 * @return {Promise} Promise resolving with the authorization code
 */

function authorizeWithoutLocalhost(opts: any): Promise<string> {
  oauth2Client.redirectUri = REDIRECT_URI_OOB;
  const authUrl = oauth2Client.generateAuthUrl(opts);
  console.log(LOG.AUTHORIZE(authUrl));

  return new Promise((res, rej) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(LOG.AUTH_CODE, (code: string) => {
      if (code && code.length) {
        res(code);
      } else {
        rej("No authorization code entered.");
      }
      rl.close();
    });
  });
}

/**
 * Gets the API FileType. Assumes the path is valid.
 * @param  {string} path The file path
 * @return {string}      The API's FileType enum (uppercase), null if not valid.
 */
function getAPIFileType(path: string): string {
  const extension: string = path.substr(path.lastIndexOf('.') + 1).toUpperCase();
  return (extension === 'GS' || extension === 'JS') ? 'SERVER_JS' : extension.toUpperCase();
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
async function checkIfOnline() {
  if (!(await isOnline())) {
    logError(null, ERROR.OFFLINE);
    process.exit(1);
  }
}

/**
 * Saves the script ID in the project dotfile.
 * @param  {string} scriptId The script ID
 */
function saveProjectId(scriptId: string): void {
  DOTFILE.PROJECT().write({ scriptId }); // Save the script id
}

/**
 * Checks if the current directory appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
function manifestExists(): boolean {
  return fs.existsSync(`${PROJECT_MANIFEST_BASENAME}.json`);
}

/**
 * Recursively finds all files that are part of the current project, and those that are ignored
 * by .claspignore and calls the passed callback function with the file lists.
 * @param {string} rootDir The project's root directory
 * @param {FilesCallBack} callback The callback will be called with the following paramters
 * error: Error if there's an error, otherwise null
 * result: string[][], List of two lists of strings, ie. [nonIgnoredFilePaths,ignoredFilePaths]
 * files?: Array<AppsScriptFile|undefined> Array of AppsScriptFile objects used by clasp push
 */
function getProjectFiles(rootDir: string, callback: FilesCallback): void {
  // Read all filenames as a flattened tree
  recursive(rootDir || path.join('.', '/'), (err, filePaths) => {
    if (err) return callback(err, null, null);
    // Filter files that aren't allowed.
    filePaths = filePaths.filter((name) => !name.startsWith('.'));
    DOTFILE.IGNORE().then((ignorePatterns: string[]) => {
      filePaths = filePaths.sort(); // Sort files alphanumerically
      let abortPush = false;
      const nonIgnoredFilePaths: string[] = [];
      const ignoredFilePaths: string[] = [];
      // Match the files with ignored glob pattern
      readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
        if (err) return callback(new Error(err), null, null);
        // Check if there are any .gs files
        // We will prompt the user to rename files
        //
        // TODO: implement renaming files from .gs to .js
        // let canRenameToJS = false;
        // filePaths.map((name, i) => {
        //   if (path.extname(name) === '.gs') {
        //     canRenameToJS = true;
        //   }
        // });
        // Check if there are files that will conflict if renamed .gs to .js
        filePaths.map((name: string) => {
          const fileNameWithoutExt = name.slice(0, -path.extname(name).length);
          if (filePaths.indexOf(fileNameWithoutExt + '.js') !== -1 &&
            filePaths.indexOf(fileNameWithoutExt + '.gs') !== -1) {
            // Can't rename, conflicting files
            abortPush = true;
            if (path.extname(name) === '.gs') { // only print error once (for .gs)
              logError(null, ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
            }
          } else if (path.extname(name) === '.gs') {
            // rename file to js
            console.log(LOG.RENAME_FILE(fileNameWithoutExt + '.gs', fileNameWithoutExt + '.js'));
            fs.renameSync(fileNameWithoutExt + '.gs', fileNameWithoutExt + '.js');
          }
        });

        if(abortPush) return callback(new Error(), null, null);

        const files = filePaths.map((name, i) => {
          let nameWithoutExt = name.slice(0, -path.extname(name).length);
          // Replace OS specific path separator to common '/' char
          nameWithoutExt = nameWithoutExt.replace(/\\/g, '/');

          // Formats rootDir/appsscript.json to appsscript.json.
          // Preserves subdirectory names in rootDir
          // (rootDir/foo/Code.js becomes foo/Code.js)
          let formattedName = nameWithoutExt;
          if (rootDir) {
            formattedName = nameWithoutExt.slice(
              rootDir.length + 1,
              nameWithoutExt.length,
            );
          }
          if (getAPIFileType(name) && !anymatch(ignorePatterns, name)) {
            nonIgnoredFilePaths.push(name);
            const file: AppsScriptFile = {
              name: formattedName, // the file base name
              type: getAPIFileType(name), // the file extension
              source: contents[i], //the file contents
            };
            return file;
          } else {
            ignoredFilePaths.push(name);
            return; // Skip ignored files
          }
        }).filter(Boolean); // remove null values
        callback(false, [nonIgnoredFilePaths, ignoredFilePaths], files);
      });
    });
  });
}
// CLI

/**
 * Set global CLI configurations
 */
commander
  .usage(`${PROJECT_NAME} <command> [options]`)
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

/**
 * Logs the user in. Saves the client credentials to an rc file.
 */
commander
  .command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .option('--ownkey', 'Save .clasprc.json file to current working directory')
  .action((options: {
    localhost: boolean;
    ownkey: boolean;
  }) => {
    // Try to read the RC file.
    DOTFILE.RC.read().then((rc: ClaspSettings) => {
      console.warn(ERROR.LOGGED_IN);
    }).catch(async (err: string) => {
      await checkIfOnline();
      authorize(options.localhost, options.ownkey);
    });
  });

/**
 * Logs out the user by deleteing client credentials.
 */
commander
  .command('logout')
  .description('Log out')
  .action(() => {
    del(DOT.RC.ABSOLUTE_PATH, { force: true }); // del doesn't work with a relative path (~)
  });

/**
 * Creates a new script project.
 * @param {string} [scriptTitle] An optional project title.
 * @param {string} [scriptParentId] An optional project parent Id. The Drive ID of a parent file
 *   that the created script project is bound to. This is usually the ID of a
 *   Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a
 *   standalone script project is created.
 * @example `create "My Script" "1D_Gxyv*****************************NXO7o"`
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create
 */
commander
  .command('create [scriptTitle] [scriptParentId]')
  .description('Create a script')
  .action(async (title: string, parentId: string) => {
    if (!title) {
      await prompt([{
        type : 'input',
        name : 'title',
        message : 'give a script title: ',
        default: LOG.UNTITLED_SCRIPT_TITLE,
      }]).then((answers) => {
        title = answers.title;
      }).catch((err) => {
        console.log(err);
      });
    }
    await checkIfOnline();
    if (fs.existsSync(DOT.PROJECT.PATH)) {
      logError(null, ERROR.FOLDER_EXISTS);
    } else {
      getAPICredentials(async () => {
        spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title)).start();
        getProjectSettings(true).then((settings: ProjectSettings) => {
          if (settings && settings.scriptId) {
            console.error(ERROR.NO_NESTED_PROJECTS);
            process.exit(1);
          }
          script.projects.create({ title, parentId }, {}).then(res => {
            spinner.stop(true);
            const scriptId = res.data.scriptId;
            console.log(LOG.CREATE_PROJECT_FINISH(scriptId));
            saveProjectId(scriptId);
            if (!manifestExists()) {
              fetchProject(scriptId); // fetches appsscript.json, o.w. `push` breaks
            }
          }).catch((error: object) => {
            spinner.stop(true);
            logError(error, ERROR.CREATE);
          });
        });
      });
    }
  });

/**
 * Fetches the files for a project from the server and writes files locally to
 * `pwd` with dots converted to subdirectories.
 * @param {string} scriptId The project script id
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 * @param {number?} versionNumber The version of files to fetch.
 */
function fetchProject(scriptId: string, rootDir = '', versionNumber?: number) {
  spinner.start();
  getAPICredentials(async () => {
    await checkIfOnline();
    script.projects.getContent({
      scriptId,
      versionNumber,
    }, {}, (error: any, { data }: any) => {
      spinner.stop(true);
      if (error) {
        if (error.statusCode === 404) return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        return logError(error, ERROR.SCRIPT_ID);
      } else {
        if (!data.files) {
          return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        }
        // Create the files in the cwd
        console.log(LOG.CLONE_SUCCESS(data.files.length));
        const sortedFiles = data.files.sort((file: AppsScriptFile) => file.name);
        sortedFiles.map((file: AppsScriptFile) => {
          const filePath = `${file.name}.${getFileType(file.type)}`;
          const truePath = `${rootDir || '.'}/${filePath}`;
          mkdirp(path.dirname(truePath), (err) => {
            if (err) return logError(err, ERROR.FS_DIR_WRITE);
            if (!file.source) return; // disallow empty files
            fs.writeFile(truePath, file.source, (err) => {
              if (err) return logError(err, ERROR.FS_FILE_WRITE);
            });
            // Log only filename if pulling to root (Code.gs vs ./Code.gs)
            console.log(`└─ ${rootDir ? truePath : filePath}`);
          });
        });
      }
    });
  });
}

/**
 * Fetches a project and saves the script id locally.
 */
commander
  .command('clone [scriptId] [versionNumber]')
  .description('Clone a project')
  .action(async (scriptId: string, versionNumber?: number) => {
      if (!scriptId) {
        getAPICredentials(async () => {
          const drive = google.drive({version: 'v3', auth: oauth2Client});
          const { data } = await drive.files.list({
            pageSize: 10,
            fields: 'files(id, name)',
            q: "mimeType='application/vnd.google-apps.script'",
          });
          const files = data.files;
          const fileIds = [];
          if (files.length) {
            files.map((file: any) => {
              fileIds.push(file.id);
            });
            await prompt([{
              type : 'list',
              name : 'scriptId',
              message : 'Clone which script? ',
              choices : fileIds,
            }]).then((answers) => {
              checkIfOnline();
              spinner.setSpinnerTitle(LOG.CLONING);
              saveProjectId(answers.scriptId);
              fetchProject(answers.scriptId, '', versionNumber);
            }).catch((err) => {
              console.log(err);
            });
          } else {
            console.log(LOG.FINDING_SCRIPTS_DNE);
          }
        });
      } else {
        await checkIfOnline();
        spinner.setSpinnerTitle(LOG.CLONING);
        saveProjectId(scriptId);
        fetchProject(scriptId, '', versionNumber);
      }
  });

/**
 * Fetches a project from either a provided or saved script id.
 */
commander
  .command('pull')
  .description('Fetch a remote project')
  .action(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
      if (scriptId) {
        spinner.setSpinnerTitle(LOG.PULLING);
        fetchProject(scriptId, rootDir);
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
commander
  .command('push')
  .description('Update the remote project')
  .action(async () => {
    await checkIfOnline();
    spinner.setSpinnerTitle(LOG.PUSHING).start();
    getAPICredentials(async () => {
      getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
        if (!scriptId) return;
        getProjectFiles(rootDir, (err, projectFiles, files) => {
          if(err) {
            console.log(err);
            spinner.stop(true);
          } else if (projectFiles) {
            const [nonIgnoredFilePaths] = projectFiles;
            script.projects.updateContent({
              scriptId,
              resource: { files },
            }, {}, (error: any, res: Function) => {
              spinner.stop(true);
              if (error) {
                console.error(LOG.PUSH_FAILURE);
                error.errors.map((err: any) => {
                  console.error(err.message);
                });
                console.error(LOG.FILES_TO_PUSH);
                nonIgnoredFilePaths.map((filePath: string) => {
                  console.error(`└─ ${filePath}`);
                });
              } else {
                nonIgnoredFilePaths.map((filePath: string) => {
                  console.log(`└─ ${filePath}`);
                });
                console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
              }
          });
        }
      });
    });
  });
});

/**
 * Lists files that will be written to the server on `push`.
 * Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 */
commander
.command('status')
.description('Lists files that will be pushed by clasp')
.action(async () => {
  await checkIfOnline();
  getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
    if (!scriptId) return;
    getProjectFiles(rootDir, (err, projectFiles) => {
      if(err) return console.log(err);
      else if (projectFiles) {
        const [nonIgnoredFilePaths, ignoredFilePaths] = projectFiles;
        console.log(LOG.STATUS_PUSH);
        nonIgnoredFilePaths.map((filePath: string) => {
              console.log(`└─ ${filePath}`);
        });
        if (ignoredFilePaths.length) {
          console.log(LOG.STATUS_IGNORE);
          ignoredFilePaths.map((filePath: string) => {
            console.log(`└─ ${filePath}`);
          });
        }
      }
    });
  });
});

/**
 * Opens the script editor in the user's browser.
 */
commander
  .command('open [scriptId]')
  .description('Open a script')
  .action(async (scriptId: string) => {
    const openScript = (scriptId?) => {
      if (!scriptId) return;
      if (scriptId.length < 30) {
        logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
      } else {
        console.log(LOG.OPEN_PROJECT(scriptId));
        open(getScriptURL(scriptId));
      }
    };
    if (scriptId) {
      openScript(scriptId);
    } else {
      getProjectSettings().then(openScript);
    }
  });

/**
 * List deployments of a script
 */
commander
  .command('deployments')
  .description('List deployment ids of a script')
  .action(async () => {
    await checkIfOnline();
    getAPICredentials(async () => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId)).start();
        script.projects.deployments.list({
          scriptId,
        }, {}, (error: any, { data }: any) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            const deployments = data.deployments;
            const numDeployments = deployments.length;
            const deploymentWord = pluralize('Deployment', numDeployments);
            console.log(`${numDeployments} ${deploymentWord}.`);
            deployments.map(({ deploymentId, deploymentConfig }: any) => {
              const versionString = !!deploymentConfig.versionNumber ?
                `@${deploymentConfig.versionNumber}` : '@HEAD';
              const description = deploymentConfig.description ?
                '- ' + deploymentConfig.description : '';
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
commander
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action(async (version: string, description: string) => {
    await checkIfOnline();
    description = description || '';
    getAPICredentials(() => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();
        function createDeployment(versionNumber: string) {
          spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
          script.projects.deployments.create({
            scriptId,
            resource: {
              versionNumber,
              manifestFileName: PROJECT_MANIFEST_BASENAME,
              description,
            },
          }, {}, (err: any, response: any) => {
            spinner.stop(true);
            if (err) {
              console.error(ERROR.DEPLOYMENT_COUNT);
            } else if (response) {
              console.log(`- ${response.data.deploymentId} @${versionNumber}.`);
            }
          });
        }

        // If the version is specified, update that deployment
        const versionRequestBody = {
          description,
        };
        if (version) {
          createDeployment(version);
        } else { // if no version, create a new version and deploy that
          script.projects.versions.create({
            scriptId,
            resource: versionRequestBody,
          }, {}, (err: any, { data }: any) => {
            spinner.stop(true);
            if (err) {
              logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
            } else {
              console.log(LOG.VERSION_CREATED(data.versionNumber));
              createDeployment(data.versionNumber);
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
commander
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action(async (deploymentId: string) => {
    await checkIfOnline();
    getAPICredentials(() => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        if (!scriptId) return;
        spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
        script.projects.deployments.delete({
          scriptId,
          deploymentId,
        }, {}, (err: any, res: any) => {  // TODO remove any
          spinner.stop(true);
          if (err) {
            logError(null, ERROR.READ_ONLY_DELETE);
          } else {
            console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
          }
        });
      });
    });
  });

/**
 * Updates deployments of a script
 */
commander
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action(async (deploymentId: string, version: string, description: string) => {
    await checkIfOnline();
    getAPICredentials(() => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        script.projects.deployments.update({
          scriptId,
          deploymentId,
          resource: {
            deploymentConfig: {
              versionNumber: version,
              manifestFileName: PROJECT_MANIFEST_BASENAME,
              description,
            },
          },
        }, {}, (error: any, res: any) => { // TODO remove any
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
commander
  .command('versions')
  .description('List versions of a script')
  .action(async () => {
    await checkIfOnline();
    spinner.setSpinnerTitle('Grabbing versions...').start();
    getAPICredentials(() => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        script.projects.versions.list({
          scriptId,
        }, {}, (error: any, { data }: any) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            if (data && data.versions && data.versions.length) {
              const numVersions = data.versions.length;
              console.log(LOG.VERSION_NUM(numVersions));
              data.versions.map((version: string) => {
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
commander
  .command('version [description]')
  .description('Creates an immutable version of the script')
  .action(async (description: string) => {
    await checkIfOnline();
    spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();
    getAPICredentials(async () => {
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        script.projects.versions.create({
          scriptId,
          description,
        }, {}, (error: any, { data }: any) => {
          spinner.stop(true);
          if (error) {
            logError(error);
          } else {
            console.log(LOG.VERSION_CREATED(data.versionNumber));
          }
        });
      }).catch((err: any) => {
        spinner.stop(true);
        logError(err);
      });
    });
  });

/**
 * Lists your most recent 10 apps scripts
 * TODO: add --all flag
 * @example `list`
 * This would show someting like:
 * helloworld1          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * helloworld2          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * helloworld3          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
commander
  .command('list')
  .description('List App Scripts projects')
  .action(async () => {
    await checkIfOnline();
    spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
    getAPICredentials(async () => {
      const drive = google.drive({version: 'v3', auth: oauth2Client});
      const res = await drive.files.list({
        pageSize: 50,
        fields: 'nextPageToken, files(id, name)',
        q: "mimeType='application/vnd.google-apps.script'",
      });
      spinner.stop(true);
      const files = res.data.files;
      if (files.length) {
        files.map((file: any) => {
          console.log(`${file.name.padEnd(20)} – ${getScriptURL(file.id)}`);
        });
      } else {
        console.log('No script files found.');
      }
    });
  });

/**
 * Prints out 5 most recent the StackDriver logs.
 * Use --json for output in json format
 * Use --open to open logs in StackDriver
 */
commander
  .command('logs')
  .description('Shows the StackDriver logs')
  .option('--json', "Show logs in JSON form")
  .option('--open', 'Open the StackDriver logs in browser')
  .action(async (cmd: {
    json: boolean,
    open: boolean,
  }) => {
    await checkIfOnline();
    function printLogs([entries]:any[]) {
      for (let i = 0; i < 5; ++i) {
        const metadata = entries[i].metadata;
        const { severity, timestamp, payload } = metadata;
        let functionName = entries[i].metadata.resource.labels.function_name;
        functionName = functionName ? functionName.padEnd(15) : ERROR.NO_FUNCTION_NAME;
        let payloadData: any = '';
        if (cmd.json) {
          payloadData = JSON.stringify(entries[i], null, 2);
        } else {
          const data = {
            textPayload: metadata.textPayload,
            jsonPayload: metadata.jsonPayload ? metadata.jsonPayload.fields.message.stringValue : '',
            protoPayload: metadata.protoPayload,
          };
          payloadData = data[payload] || ERROR.PAYLOAD_UNKNOWN;

          if (payloadData && typeof(payloadData) === 'string') {
            payloadData = payloadData.padEnd(20);
          }
        }
        let coloredSeverity = ({
          ERROR: chalk.red(severity),
          INFO: chalk.blue(severity),
          DEBUG: chalk.yellow(severity),
          NOTICE: chalk.magenta(severity),
        })[severity] || severity;
        coloredSeverity = String(coloredSeverity).padEnd(20);
        console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
      }
    }

    getProjectSettings().then(({ scriptId, rootDir, projectId }: ProjectSettings) => {
      if (!projectId) {
        console.error(ERROR.NO_GCLOUD_PROJECT);
        process.exit(-1);
      }
      if (cmd.open) {
        const url = 'https://console.cloud.google.com/logs/viewer?project=' +
            `${projectId}&resource=app_script_function`;
        console.log(`Opening logs: ${url}`);
        open(url);
        process.exit(0);
      }
      const logger = new logging({
        projectId,
      });
      return logger.getEntries().then(printLogs).catch((err) => {
        console.error(ERROR.LOGS_UNAVAILABLE);
      });
    });
  });

/**
 * Clasp run <functionName>
 * This function runs your script in the cloud. You must supply
 * the functionName params. For now, it can
 * only run functions that do not require other authorization.
 * @param functionName function in the script that you want to run
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
 * Note: to use this command, you must have used `clasp login --ownkey`
 */
commander
  .command('run <functionName>')
  .description('Run a function in your Apps Scripts project')
  .action((functionName) => {
    console.log('start run');
    getAPICredentials(async () => {
      console.log('got creds');
      await checkIfOnline();
      console.log('online');
      getProjectSettings().then(({ scriptId }: ProjectSettings) => {
        const params = {
          scriptId,
          function: functionName,
          devMode: true,
        };
        console.log('about to run');
        script.scripts.run(params).then(response => {
          console.log(response.data);
        }).catch(e => {
          console.log(e);
        });
      });
    }, true);
  });

/**
 * Displays the help function
 */
commander
  .command('help')
  .description('Display help')
  .action(() => {
    commander.outputHelp();
  });

/**
 * All other commands are given a help message.
 */
commander
  .command('*', { isDefault: true })
  .description('Any other command is not supported')
  .action((command: string) => {
    console.error(ERROR.COMMAND_DNE(command));
  });

// defaults to help if commands are not provided
if (!process.argv.slice(2).length) {
  commander.outputHelp();
}

// User input is provided from the process' arguments
commander.parse(process.argv);
