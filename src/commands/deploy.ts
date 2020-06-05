import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {PROJECT_MANIFEST_BASENAME} from '../constants';
import {ERROR, LOG} from '../messages';
import {checkIfOnline, getProjectSettings, spinner} from '../utils';

interface CommandOption {
  readonly versionNumber?: number;
  readonly description?: string;
  readonly deploymentId?: string;
}

/**
 * Deploys an Apps Script project.
 * @param options.versionNumber {string} The project version to deploy at.
 * @param options.description   {string} The deployment description.
 * @param options.deploymentId  {string} The deployment ID to redeploy.
 */
export default async (options: CommandOption): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const {scriptId} = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();
  let {versionNumber} = options;
  const {description = '', deploymentId} = options;

  // If no version, create a new version
  if (!versionNumber) {
    const version = await script.projects.versions.create({
      scriptId,
      requestBody: {
        description,
      },
    });
    if (version.status !== 200) throw new ClaspError(ERROR.ONE_DEPLOYMENT_CREATE);
    if (spinner.isSpinning()) spinner.stop(true);
    versionNumber = version.data.versionNumber ?? 0;
    console.log(LOG.VERSION_CREATED(versionNumber));
  }

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
  let deployments;
  if (deploymentId) {
    // Elseif, update deployment
    deployments = await script.projects.deployments.update({
      scriptId,
      deploymentId,
      requestBody: {
        deploymentConfig: {
          versionNumber,
          manifestFileName: PROJECT_MANIFEST_BASENAME,
          description,
        },
      },
    });
  } else {
    // If no deploymentId, create a new deployment
    deployments = await script.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: PROJECT_MANIFEST_BASENAME,
        description,
      },
    });
  }

  if (deployments.status !== 200) throw new ClaspError(ERROR.DEPLOYMENT_COUNT);
  if (spinner.isSpinning()) spinner.stop(true);
  console.log(`- ${deployments.data.deploymentId} @${versionNumber}.`);
};
