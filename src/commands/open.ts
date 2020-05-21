import {script_v1 as scriptV1} from 'googleapis';
import open from 'open';

import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {deploymentIdPrompt} from '../inquirer';
import {ERROR, LOG} from '../messages';
import {URL} from '../urls';
import {ellipsize, getProjectSettings, getWebApplicationURL} from '../utils';

interface CommandOption {
  readonly webapp?: boolean;
  readonly creds?: boolean;
  readonly addon?: boolean;
  readonly deploymentId?: string;
}

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param options.webapp {boolean} If true, the command will open the webapps URL.
 * @param options.creds {boolean} If true, the command will open the credentials URL.
 * @param options.deploymentId {string} Use custom deployment ID with webapp.
 */
export default async (scriptId: string, options: CommandOption): Promise<void> => {
  const projectSettings = await getProjectSettings();
  if (!scriptId) scriptId = projectSettings.scriptId;
  if (scriptId.length < 30) throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // We've specified to open creds.
  if (options.creds) {
    const {projectId} = projectSettings;
    if (projectId) {
      console.log(LOG.OPEN_CREDS(projectId));
      await open(URL.CREDS(projectId));
      return;
    }

    throw new ClaspError(ERROR.NO_GCLOUD_PROJECT);
  }

  // We've specified to print addons and open the first one.
  if (options.addon) {
    const {parentId} = projectSettings;
    if (parentId && parentId.length > 0) {
      if (parentId.length > 1) {
        parentId.forEach(id => {
          console.log(LOG.FOUND_PARENT(id));
        });
      }

      console.log(LOG.OPEN_FIRST_PARENT(parentId[0]));
      await open(URL.DRIVE(parentId[0]));
      return;
    }

    throw new ClaspError(ERROR.NO_PARENT_ID);
  }

  // If we're not a web app, open the script URL.
  if (!options.webapp) {
    console.log(LOG.OPEN_PROJECT(scriptId));
    await open(URL.SCRIPT(scriptId));
    return;
  }

  // Web app: Otherwise, open the latest deployment.
  await loadAPICredentials();
  const deploymentsList = await script.projects.deployments.list({scriptId});
  if (deploymentsList.status !== 200) throw new ClaspError(deploymentsList.statusText);
  const deployments: Array<Readonly<scriptV1.Schema$Deployment>> = deploymentsList.data.deployments ?? [];
  if (deployments.length === 0) throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // Order deployments by update time.
  const choices = deployments
    .slice()
    .sort((d1, d2) => {
      if (d1.updateTime && d2.updateTime) {
        return d1.updateTime.localeCompare(d2.updateTime);
      }

      return 0; // Should never happen
    })
    .map(deployment => {
      const config = deployment.deploymentConfig as scriptV1.Schema$DeploymentConfig;
      const version = config.versionNumber;
      const description = config.description ?? '';
      return {
        name: `${ellipsize(description, 30)}@${(typeof version === 'number' ? `${version}` : 'HEAD').padEnd(4)} - ${
          deployment.deploymentId
        }`,
        value: deployment,
      };
    });

  let { deploymentId } = options;
  if (!deploymentId) {
    const { deployment: { deploymentId: depIdFromPrompt } } = await deploymentIdPrompt(choices);
    deploymentId = (depIdFromPrompt as string);
  }

  const deployment = await script.projects.deployments.get({
    scriptId,
    deploymentId,
  });
  console.log(LOG.OPEN_WEBAPP(deploymentId as string));
  const target = getWebApplicationURL(deployment.data);
  if (target) {
    await open(target, {wait: false});
  } else {
    throw new ClaspError(`Could not open deployment: ${JSON.stringify(deployment)}`);
  }
};
