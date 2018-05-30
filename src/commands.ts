import * as del from 'del';
import * as pluralize from 'pluralize';
import { drive, getAPICredentials, logger, script } from './auth';
import {fetchProject, getProjectFiles, hasProject} from './files';
import {
  DOT,
  ERROR,
  PROJECT_MANIFEST_BASENAME,
  PROJECT_NAME,
  ProjectSettings,
  checkIfOnline,
  getProjectSettings,
  getScriptURL,
  logError,
  manifestExists,
  saveProjectId,
  spinner,
} from './utils';
const open = require('open');
const commander = require('commander');
const chalk = require('chalk');
const { prompt } = require('inquirer');

// Log messages (some logs take required params)
export const LOG = {
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
    DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments...`,
    DEPLOYMENT_START: (scriptId: string) => `Deploying project...`,
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

export const pull = async () => {
  await checkIfOnline();
  const { scriptId, rootDir } = await getProjectSettings();
  if (scriptId) {
    spinner.setSpinnerTitle(LOG.PULLING);
    fetchProject(scriptId, rootDir);
  }
};
export const push = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.PUSHING).start();
  getAPICredentials(async () => {
    const { scriptId, rootDir } = await getProjectSettings();
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
          }, {}, (error: any) => {
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
              process.exit(1);
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
};

export const help = () => {
  commander.outputHelp();
};
export const defaultCmd = (command: string) => {
  console.error(ERROR.COMMAND_DNE(command));
};

export const create = async (title: string, parentId: string) => {
  await checkIfOnline();
  if (hasProject()) {
    logError(null, ERROR.FOLDER_EXISTS);
  } else {
    if (!title) {
      await prompt([{
        type : 'input',
        name : 'title',
        message : 'Give a script title:',
        default: LOG.UNTITLED_SCRIPT_TITLE,
      }]).then((answers: any) => {
        title = answers.title;
      }).catch((err: any) => {
        console.log(err);
      });
    }
    getAPICredentials(async () => {
      spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title)).start();
      try {
        const { scriptId } = await getProjectSettings(true);
        if (scriptId) {
          console.error(ERROR.NO_NESTED_PROJECTS);
          process.exit(1);
        }
      } catch (err) { // no scriptId (because project doesn't exist)
        //console.log(err);
      }
      script.projects.create({ title, parentId }, {}).then(res => {
        spinner.stop(true);
        const createdScriptId = res.data.scriptId;
        console.log(LOG.CREATE_PROJECT_FINISH(createdScriptId));
        saveProjectId(createdScriptId);
        if (!manifestExists()) {
          fetchProject(createdScriptId); // fetches appsscript.json, o.w. `push` breaks
        }
      }).catch((error: object) => {
        spinner.stop(true);
        logError(error, ERROR.CREATE);
      });
    });
  }
};
export const clone = async (scriptId: string, versionNumber?: number) => {
  await checkIfOnline();
  if (hasProject()) {
    logError(null, ERROR.FOLDER_EXISTS);
  } else {
    if (!scriptId) {
      getAPICredentials(async () => {
        const { data } = await drive.files.list({
          pageSize: 10,
          fields: 'files(id, name)',
          q: 'mimeType="application/vnd.google-apps.script"',
        });
        const files = data.files;
        if (files.length) {
          const fileIds = files.map((file: any) => {
            return {
              name: `${file.name}`.padEnd(20) + ` - (${file.id})`,
              value: file.id,
            };
          });
          await prompt([{
            type : 'list',
            name : 'scriptId',
            message : 'Clone which script? ',
            choices : fileIds,
          }]).then((answers: any) => {
            checkIfOnline();
            spinner.setSpinnerTitle(LOG.CLONING);
            saveProjectId(answers.scriptId);
            fetchProject(answers.scriptId, '', versionNumber);
          }).catch((err: any) => {
            console.log(err);
          });
        } else {
          console.log(LOG.FINDING_SCRIPTS_DNE);
        }
      });
    } else {
      spinner.setSpinnerTitle(LOG.CLONING);
      saveProjectId(scriptId);
      fetchProject(scriptId, '', versionNumber);
    }
  }
};
export const logout = () => {
  del(DOT.RC.ABSOLUTE_PATH, { force: true }); // del doesn't work with a relative path (~)
  del(DOT.RC.ABSOLUTE_LOCAL_PATH, { force: true });
};
export const logs = async (cmd: {
  json: boolean,
  open: boolean,
}) => {
  await checkIfOnline();
  function printLogs(entries: any[]) {
    for (let i = 0; i < 50 && i < entries.length; ++i) {
      const { severity, timestamp, resource, textPayload, protoPayload, jsonPayload } = entries[i];
      let functionName = resource.labels.function_name;
      functionName = functionName ? functionName.padEnd(15) : ERROR.NO_FUNCTION_NAME;
      let payloadData: any = '';
      if (cmd.json) {
        payloadData = JSON.stringify(entries[i], null, 2);
      } else {
        const data: any = {
          textPayload,
          jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
          protoPayload,
        };
        payloadData = data.textPayload || data.jsonPayload || data.protoPayload || ERROR.PAYLOAD_UNKNOWN;
        if (payloadData && typeof(payloadData) === 'string') {
          payloadData = payloadData.padEnd(20);
        }
      }
      const coloredStringMap: any = {
        ERROR: chalk.red(severity),
        INFO: chalk.blue(severity),
        DEBUG: chalk.yellow(severity),
        NOTICE: chalk.magenta(severity),
      };
      let coloredSeverity:string = coloredStringMap[severity] || severity;
      coloredSeverity = String(coloredSeverity).padEnd(20);
      console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
    }
  }
  const { projectId } = await getProjectSettings();
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
  getAPICredentials(async () => {
    const { data } = await logger.entries.list({
      resourceNames: [
        `projects/${projectId}`,
      ],
    });
    printLogs(data.entries);
  });
};
export const run = (functionName:string) => {
  getAPICredentials(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      const params = {
        scriptId,
        function: functionName,
        devMode: false,
      };
      script.scripts.run(params).then(response => {
        console.log(response.data);
      }).catch(e => {
        console.log(e);
      });
    });
  });
};

export const deploy = async (version: string, description: string) => {
  await checkIfOnline();
  description = description || '';
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
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
};
export const undeploy = async (deploymentId: string) => {
  await checkIfOnline();
  getAPICredentials(() => {
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
      script.projects.deployments.delete({
        scriptId,
        deploymentId,
      }, {}, (err: any, res: any) => {
        spinner.stop(true);
        if (err) {
          logError(null, ERROR.READ_ONLY_DELETE);
        } else {
          console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
        }
      });
    });
  });
};
export const versions = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
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
};
export const version = async (description: string) => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
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
  });
};
export const list = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
  getAPICredentials(async () => {
    const res = await drive.files.list({
      pageSize: 50,
      fields: 'nextPageToken, files(id, name)',
      q: 'mimeType="application/vnd.google-apps.script"',
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
};
export const redeploy = async (deploymentId: string, version: string, description: string) => {
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
      }, {}, (error: any, res: any) => {
        spinner.stop(true);
        if (error) {
          logError(null, error); // TODO prettier error
        } else {
          console.log(LOG.REDEPLOY_END);
        }
      });
    });
  });
};
export const status = async (cmd: { json: boolean }) => {
  await checkIfOnline();
  getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
    if (!scriptId) return;
    getProjectFiles(rootDir, (err, projectFiles) => {
      if(err) return console.log(err);
      else if (projectFiles) {
        const [filesToPush, untrackedFiles] = projectFiles;
        if (cmd.json) {
          console.log(JSON.stringify({ filesToPush, untrackedFiles }));
        } else {
          console.log(LOG.STATUS_PUSH);
          filesToPush.forEach((file) => console.log(`└─ ${file}`));
          console.log(LOG.STATUS_IGNORE);
          untrackedFiles.forEach((file) => console.log(`└─ ${file}`));
        }
      }
    });
  });
};
export const openCmd = async (scriptId: any) => {
  if (!scriptId) {
    const settings = await getProjectSettings();
    scriptId = settings.scriptId;
  }
  if (scriptId.length < 30) {
    logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  } else {
    console.log(LOG.OPEN_PROJECT(scriptId));
    open(getScriptURL(scriptId));
  }
};
export const deployments = async () => {
  await checkIfOnline();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
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
};