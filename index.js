#!/usr/bin/env node
"use strict";
exports.__esModule = true;
var anymatch = require("anymatch");
require("connect");
var del = require("del");
var dotf = require('dotf');
var findParentDir = require('find-parent-dir');
var fs = require("fs");
var google = require('googleapis');
var http = require("http");
var mkdirp = require("mkdirp");
var OAuth2 = google.auth.OAuth2;
require("open");
var os = require("os");
var path = require('path');
var pluralize = require("pluralize");
var commander = require('commander');
var read = require('read-file');
var readMultipleFiles = require('read-multiple-files');
var recursive = require("recursive-readdir");
var cli_spinner_1 = require("cli-spinner");
var splitLines = require('split-lines');
var url = require("url");
var readline = require('readline');
var Promise = require("bluebird");
require('http-shutdown').extend();
// Debug
var DEBUG = false;
// Names / Paths
var PROJECT_NAME = 'clasp';
var PROJECT_MANIFEST_BASENAME = 'appsscript';
var PROJECT_MANIFEST_FULLNAME = PROJECT_MANIFEST_BASENAME + ".json";
// Dotfile names
var DOT = {
    IGNORE: {
        DIR: '~',
        NAME: PROJECT_NAME + "ignore",
        PATH: "." + PROJECT_NAME + "ignore"
    },
    PROJECT: {
        DIR: './',
        NAME: PROJECT_NAME + ".json",
        PATH: "." + PROJECT_NAME + ".json"
    },
    RC: {
        DIR: '~',
        NAME: PROJECT_NAME + "rc.json",
        PATH: "~/." + PROJECT_NAME + "rc.json",
        ABSOLUTE_PATH: path.join(os.homedir(), "." + PROJECT_NAME + "rc.json")
    }
};
// Dotfile files
var DOTFILE = {
    /**
     * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
     * @return {Promise<string[]>} A list of file glob patterns
     */
    IGNORE: function () {
        var projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
        var path = projectDirectory + "/" + DOT.IGNORE.PATH;
        return new Promise(function (res, rej) {
            if (fs.existsSync(path)) {
                var buffer = read.sync(DOT.IGNORE.PATH, 'utf8');
                res(splitLines(buffer).filter(function (name) { return name; }));
            }
            else {
                res([]);
            }
        });
    },
    /**
     * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
     * that the command was run in.
     * @return {dotf} A dotf with that dotfile. Null if there is no file
     */
    PROJECT: function () {
        var projectDirectory = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
        return dotf(projectDirectory, DOT.PROJECT.NAME);
    },
    // See `login`: Stores { accessToken, refreshToken }
    RC: dotf(DOT.RC.DIR, DOT.RC.NAME)
};
// API settings
// @see https://developers.google.com/oauthplayground/
var REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
var oauth2Client = new OAuth2('1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com', // CLIENT_ID
'v6V3fKV_zWU7iw1DrpO1rknX', // CLIENT_SECRET
'http://localhost');
var script = google.script({
    version: 'v1',
    auth: oauth2Client
});
// Log messages (some logs take required params)
var LOG = {
    AUTH_CODE: 'Enter the code from that page here: ',
    AUTH_PAGE_SUCCESSFUL: "Logged in! You may close this page.",
    AUTH_SUCCESSFUL: "Saved the credentials to " + DOT.RC.PATH + ". You may close the page.",
    AUTHORIZE: function (authUrl) { return "\uD83D\uDD11  Authorize " + PROJECT_NAME + " by visiting this url:\n" + authUrl + "\n"; },
    CLONE_SUCCESS: function (fileNum) { return "Cloned " + fileNum + " " + pluralize('files', fileNum) + "."; },
    CLONING: 'Cloning files...',
    CREATE_PROJECT_FINISH: function (scriptId) { return "Created new script: " + getScriptURL(scriptId) + "."; },
    CREATE_PROJECT_START: function (title) { return "Creating new script: " + title + "..."; },
    DEPLOYMENT_CREATE: 'Creating deployment...',
    DEPLOYMENT_DNE: 'No deployed versions of script.',
    DEPLOYMENT_LIST: function (scriptId) { return "Listing deployments for " + scriptId + "..."; },
    DEPLOYMENT_START: function (scriptId) { return "Deploying project " + scriptId + "..."; },
    OPEN_PROJECT: function (scriptId) { return "Opening script: " + scriptId; },
    PULLING: 'Pulling files...',
    PUSH_SUCCESS: function (numFiles) { return "Pushed " + numFiles + " " + pluralize('files', numFiles) + "."; },
    PUSH_FAILURE: 'Push failed. Errors:',
    PUSHING: 'Pushing files...',
    REDEPLOY_END: 'Updated deployment.',
    REDEPLOY_START: 'Updating deployment...',
    UNDEPLOYMENT_FINISH: function (deploymentId) { return "Undeployed " + deploymentId + "."; },
    UNDEPLOYMENT_START: function (deploymentId) { return "Undeploy " + deploymentId + "..."; },
    UNTITLED_SCRIPT_TITLE: 'Untitled Script',
    VERSION_CREATE: 'Creating a new version...',
    VERSION_CREATED: function (versionNumber) { return "Created version " + versionNumber + "."; },
    VERSION_DESCRIPTION: function (_a) {
        var versionNumber = _a.versionNumber, description = _a.description;
        return versionNumber + " - " + (description || '(no description)');
    },
    VERSION_NUM: function (numVersions) { return "~ " + numVersions + " " + pluralize('Version', numVersions) + " ~"; }
};
// Error messages (some errors take required params)
var ERROR = {
    ACCESS_TOKEN: "Error retrieving access token: ",
    COMMAND_DNE: function (command) { return "\uD83E\uDD14  Unknown command \"" + command + "\"\n\nForgot " + PROJECT_NAME + " commands? Get help:\n  " + PROJECT_NAME + " --help"; },
    CREATE: 'Error creating script.',
    DEPLOYMENT_COUNT: "Unable to deploy; Only one deployment can be created at a time",
    FOLDER_EXISTS: "Project file (" + DOT.PROJECT.PATH + ") already exists.",
    FS_DIR_WRITE: 'Could not create directory.',
    FS_FILE_WRITE: 'Could not write file.',
    LOGGED_IN: "You seem to already be logged in. Did you mean to 'logout'?",
    LOGGED_OUT: "Please login. (" + PROJECT_NAME + " login)",
    ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
    READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
    PERMISSION_DENIED: "Error: Permission denied. Enable the Apps Script API:\nhttps://script.google.com/home/usersettings",
    SCRIPT_ID: '\n> Did you provide the correct scriptId?\n',
    SCRIPT_ID_DNE: "No " + DOT.PROJECT.PATH + " settings found. `create` or `clone` a project first.",
    SCRIPT_ID_INCORRECT: function (scriptId) { return "The scriptId \"" + scriptId + "\" looks incorrect.\nDid you provide the correct scriptId?"; },
    UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.'
};
// Utils
var spinner = new cli_spinner_1.Spinner();
/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
var logError = function (err, description) {
    if (description === void 0) { description = ''; }
    // Errors are weird. The API returns interesting error structures.
    // TODO(timmerman) This will need to be standardized. Waiting for the API to
    // change error model. Don't review this method now.
    if (err && typeof err.error === 'string') {
        console.error(JSON.parse(err.error).error);
    }
    else if (err && err.statusCode === 401 || err && err.error && err.error.error && err.error.error.code === 401) {
        console.error(ERROR.UNAUTHENTICATED);
    }
    else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
        console.error(ERROR.PERMISSION_DENIED);
    }
    else {
        if (err && err.error) {
            console.error("~~ API ERROR (" + (err.statusCode || err.error.code) + ")");
            console.error(err.error);
        }
        if (description)
            console.error(description);
    }
};
/**
 * Gets the script URL from a script ID.
 *
 * It is too expensive to get the script URL from the Drive API. (Async/not offline)
 * @param  {string} scriptId The script ID
 * @return {string}          The URL of the script in the online script editor.
 */
var getScriptURL = function (scriptId) { return "https://script.google.com/d/" + scriptId + "/edit"; };
/**
 * Gets the project settings from the project dotfile. Logs errors.
 * Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise} A promise to get the project script ID.
 */
function getProjectSettings() {
    return new Promise(function (resolve, reject) {
        var fail = function () {
            logError(null, ERROR.SCRIPT_ID_DNE);
            reject();
        };
        var dotfile = DOTFILE.PROJECT();
        if (dotfile) {
            // Found a dotfile, but does it have the settings, or is it corrupted?
            dotfile.read().then(function (settings) {
                // Settings must have the script ID. Otherwise we err.
                if (settings.scriptId) {
                    resolve(settings);
                }
                else {
                    // TODO: Better error message
                    fail(); // Script ID DNE
                }
            })["catch"](function (err) {
                fail(); // Failed to read dotfile
            });
        }
        else {
            fail(); // Never found a dotfile
        }
    })["catch"](function (err) {
        logError(err);
        spinner.stop(true);
    });
}
/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 * @param {Function} cb The callback
 */
function getAPICredentials(cb) {
    DOTFILE.RC.read().then(function (rc) {
        oauth2Client.credentials = rc;
        cb(rc);
    })["catch"](function (err) {
        logError(null, ERROR.LOGGED_OUT);
    });
}
/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 */
function authorize(useLocalhost) {
    var options = {
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/script.deployments',
            'https://www.googleapis.com/auth/script.projects',
        ]
    };
    var authCode = useLocalhost ?
        authorizeWithLocalhost(options) :
        authorizeWithoutLocalhost(options);
    authCode.then(function (code) {
        return new Promise(function (res, rej) {
            oauth2Client.getToken(code, function (err, token) {
                if (err)
                    return rej(err);
                return res(token);
            });
        });
    })
        .then(function (token) { return DOTFILE.RC.write(token); })
        .then(function () { return console.log(LOG.AUTH_SUCCESSFUL); })["catch"](function (err) { return console.error(ERROR.ACCESS_TOKEN + err); });
}
/**
 * Requests authorization to manage Apps Scrpit projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 *
 * @param {Object} opts OAuth2 options
 * @return {Promise} Promise resolving with the authorization code
 */
function authorizeWithLocalhost(opts) {
    return new Promise(function (res, rej) {
        var server = http.createServer(function (req, resp) {
            var urlParts = url.parse(req.url, true);
            var code = urlParts.query.code;
            if (urlParts.query.code) {
                res(urlParts.query.code.toString()); // query.code can be a string[], parse to string
            }
            else {
                rej(urlParts.query.error);
            }
            resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
        });
        server.listen(0, function () {
            oauth2Client._redirectUri = "http://localhost:" + server.address().port;
            var authUrl = oauth2Client.generateAuthUrl(opts);
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
function authorizeWithoutLocalhost(opts) {
    oauth2Client._redirectUri = REDIRECT_URI_OOB;
    var authUrl = oauth2Client.generateAuthUrl(opts);
    console.log(LOG.AUTHORIZE(authUrl));
    return new Promise(function (res, rej) {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(LOG.AUTH_CODE, function (code) {
            if (code && code.length) {
                res(code);
            }
            else {
                rej("No authorization code entered.");
            }
            rl.close();
        });
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
    var extension = path.substr(path.lastIndexOf('.') + 1).toUpperCase();
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
    DOTFILE.PROJECT().write({ scriptId: scriptId }); // Save the script id
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
commander
    .usage('<command> [options]')
    .description(PROJECT_NAME + " - The Apps Script CLI");
/**
 * Logs the user in. Saves the client credentials to an rc file.
 */
commander
    .command('login')
    .description('Log in to script.google.com')
    .option('--no-localhost', 'Do not run a local server, manually enter code instead')
    .action(function (cmd) {
    // Try to read the RC file.
    DOTFILE.RC.read().then(function (rc) {
        console.warn(ERROR.LOGGED_IN);
    })["catch"](function (err) {
        authorize(cmd.localhost);
    });
});
/**
 * Logs out the user by deleteing client credentials.
 */
commander
    .command('logout')
    .description('Log out')
    .action(function () {
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
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create#body.request_body.FIELDS.parent_id
 */
commander
    .command('create [scriptTitle] [scriptParentId]')
    .description('Create a script')
    .action(function (title, parentId) {
    if (title === void 0) { title = LOG.UNTITLED_SCRIPT_TITLE; }
    if (fs.existsSync(DOT.PROJECT.PATH)) {
        logError(null, ERROR.FOLDER_EXISTS);
    }
    else {
        getAPICredentials(function () {
            spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title));
            spinner.start();
            script.projects.create({ title: title, parentId: parentId }, {}, function (error, _a) {
                var scriptId = _a.scriptId;
                spinner.stop(true);
                if (error) {
                    logError(error, ERROR.CREATE);
                }
                else {
                    console.log(LOG.CREATE_PROJECT_FINISH(scriptId));
                    saveProjectId(scriptId);
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
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
function fetchProject(scriptId, rootDir) {
    if (rootDir === void 0) { rootDir = null; }
    spinner.start();
    getAPICredentials(function () {
        script.projects.getContent({
            scriptId: scriptId
        }, {}, function (error, res) {
            spinner.stop(true);
            if (error) {
                if (error.statusCode === 404) {
                    logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
                }
                else {
                    logError(error, ERROR.SCRIPT_ID);
                }
            }
            else {
                if (!res.files) {
                    return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
                }
                // Create the files in the cwd
                console.log(LOG.CLONE_SUCCESS(res.files.length));
                var sortedFiles = res.files.sort(function (file) { return file.name; });
                sortedFiles.map(function (file) {
                    var filePath = file.name + "." + getFileType(file.type);
                    var truePath = (rootDir || '.') + "/" + filePath;
                    mkdirp(path.dirname(truePath), function (err) {
                        if (err)
                            return logError(err, ERROR.FS_DIR_WRITE);
                        fs.writeFile(truePath, file.source, function (err) {
                            if (err)
                                return logError(err, ERROR.FS_FILE_WRITE);
                        });
                        // Log only filename if pulling to root (Code.gs vs ./Code.gs)
                        console.log("\u2514\u2500 " + (rootDir ? truePath : filePath));
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
    .command('clone <scriptId>')
    .description('Clone a project')
    .action(function (scriptId) {
    spinner.setSpinnerTitle(LOG.CLONING);
    saveProjectId(scriptId);
    fetchProject(scriptId);
});
/**
 * Fetches a project from either a provided or saved script id.
 */
commander
    .command('pull')
    .description('Fetch a remote project')
    .action(function () {
    getProjectSettings().then(function (_a) {
        var scriptId = _a.scriptId, rootDir = _a.rootDir;
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
    .action(function () {
    spinner.setSpinnerTitle(LOG.PUSHING);
    spinner.start();
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId, rootDir = _a.rootDir;
            if (!scriptId)
                return;
            // Read all filenames as a flattened tree
            recursive(rootDir || './', function (err, filePaths) {
                if (err)
                    return logError(err);
                // Filter files that aren't allowed.
                filePaths = filePaths.filter(function (name) { return !name.startsWith('.'); });
                DOTFILE.IGNORE().then(function (ignorePatterns) {
                    filePaths = filePaths.sort(); // Sort files alphanumerically
                    // Match the files with ignored glob pattern
                    readMultipleFiles(filePaths, 'utf8', function (err, contents) {
                        if (err)
                            return console.error(err);
                        var nonIgnoredFilePaths = [];
                        var files = filePaths.map(function (name, i) {
                            var nameWithoutExt = name.slice(0, -path.extname(name).length);
                            // Formats rootDir/appsscript.json to appsscript.json. 
                            // Preserves subdirectory names in rootDir 
                            // (rootDir/foo/Code.js becomes foo/Code.js)
                            var formattedName = nameWithoutExt;
                            if (rootDir) {
                                formattedName = nameWithoutExt.slice(rootDir.length + 1, nameWithoutExt.length);
                            }
                            if (getAPIFileType(name) && !anymatch(ignorePatterns, name)) {
                                nonIgnoredFilePaths.push(name);
                                var file = {
                                    name: formattedName,
                                    type: getAPIFileType(name),
                                    source: contents[i] //the file contents
                                };
                                return file;
                            }
                            else {
                                return; // Skip ignored files
                            }
                        }).filter(Boolean); // remove null values
                        script.projects.updateContent({
                            scriptId: scriptId,
                            resource: { files: files }
                        }, {}, function (error, res) {
                            spinner.stop(true);
                            if (error) {
                                console.error(LOG.PUSH_FAILURE);
                                error.errors.map(function (err) {
                                    console.error(err.message);
                                });
                            }
                            else {
                                nonIgnoredFilePaths.map(function (filePath) {
                                    console.log("\u2514\u2500 " + filePath);
                                });
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
commander
    .command('open')
    .description('Open a script')
    .action(function (scriptId) {
    getProjectSettings().then(function (_a) {
        var scriptId = _a.scriptId;
        if (scriptId) {
            console.log(LOG.OPEN_PROJECT(scriptId));
            if (scriptId.length < 30) {
                logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
            }
            else {
                open(getScriptURL(scriptId));
            }
        }
    });
});
/**
 * List deployments of a script
 */
commander
    .command('deployments')
    .description('List deployment ids of a script')
    .action(function () {
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            if (!scriptId)
                return;
            spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId));
            spinner.start();
            script.projects.deployments.list({
                scriptId: scriptId
            }, {}, function (error, _a) {
                var deployments = _a.deployments;
                spinner.stop(true);
                if (error) {
                    logError(error);
                }
                else {
                    var numDeployments = deployments.length;
                    var deploymentWord = pluralize('Deployment', numDeployments);
                    console.log(numDeployments + " " + deploymentWord + ".");
                    deployments.map(function (_a) {
                        var deploymentId = _a.deploymentId, deploymentConfig = _a.deploymentConfig;
                        var versionString = !!deploymentConfig.versionNumber ?
                            "@" + deploymentConfig.versionNumber : '@HEAD';
                        var description = deploymentConfig.description ?
                            '- ' + deploymentConfig.description : '';
                        console.log("- " + deploymentId + " " + versionString + " " + description);
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
    .action(function (version, description) {
    description = description || '';
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            if (!scriptId)
                return;
            spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId));
            spinner.start();
            function createDeployment(versionNumber) {
                spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
                script.projects.deployments.create({
                    scriptId: scriptId,
                    resource: {
                        versionNumber: versionNumber,
                        manifestFileName: PROJECT_MANIFEST_BASENAME,
                        description: description
                    }
                }, {}, function (err, res) {
                    spinner.stop(true);
                    if (err) {
                        console.error(ERROR.DEPLOYMENT_COUNT);
                    }
                    else {
                        console.log("- " + res.deploymentId + " @" + versionNumber + ".");
                    }
                });
            }
            // If the version is specified, update that deployment
            var versionRequestBody = {
                description: description
            };
            if (version) {
                createDeployment(+version);
            }
            else {
                script.projects.versions.create({
                    scriptId: scriptId,
                    resource: versionRequestBody
                }, {}, function (err, res) {
                    spinner.stop(true);
                    if (err) {
                        logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
                    }
                    else {
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
commander
    .command('undeploy <deploymentId>')
    .description('Undeploy a deployment of a project')
    .action(function (deploymentId) {
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            if (!scriptId)
                return;
            spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId));
            spinner.start();
            script.projects.deployments["delete"]({
                scriptId: scriptId,
                deploymentId: deploymentId
            }, {}, function (err, res) {
                spinner.stop(true);
                if (err) {
                    logError(null, ERROR.READ_ONLY_DELETE);
                }
                else {
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
    .description("Update a deployment")
    .action(function (deploymentId, version, description) {
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            script.projects.deployments.update({
                scriptId: scriptId,
                deploymentId: deploymentId,
                resource: {
                    deploymentConfig: {
                        versionNumber: version,
                        manifestFileName: PROJECT_MANIFEST_BASENAME,
                        description: description
                    }
                }
            }, {}, function (error, res) {
                spinner.stop(true);
                if (error) {
                    logError(null, error); // TODO prettier error
                }
                else {
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
    .action(function () {
    spinner.setSpinnerTitle('Grabbing versions...');
    spinner.start();
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            script.projects.versions.list({
                scriptId: scriptId
            }, {}, function (error, res) {
                spinner.stop(true);
                if (error) {
                    logError(error);
                }
                else {
                    if (res && res.versions && res.versions.length) {
                        var numVersions = res.versions.length;
                        console.log(LOG.VERSION_NUM(numVersions));
                        res.versions.map(function (version) {
                            console.log(LOG.VERSION_DESCRIPTION(version));
                        });
                    }
                    else {
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
    .action(function (description) {
    spinner.setSpinnerTitle(LOG.VERSION_CREATE);
    spinner.start();
    getAPICredentials(function () {
        getProjectSettings().then(function (_a) {
            var scriptId = _a.scriptId;
            script.projects.versions.create({
                scriptId: scriptId,
                description: description
            }, {}, function (error, res) {
                spinner.stop(true);
                if (error) {
                    logError(error);
                }
                else {
                    console.log(LOG.VERSION_CREATED(res.versionNumber));
                }
            });
        })["catch"](function (err) {
            spinner.stop(true);
            logError(err);
        });
    });
});
/**
 * All other commands are given a help message.
 */
commander
    .command('*', { isDefault: true })
    .action(function (command) {
    console.error(ERROR.COMMAND_DNE(command));
});
// User input is provided from the process' arguments
commander.parse(process.argv);
