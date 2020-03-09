import { loadAPICredentials, script } from '../auth';
import {
  checkIfOnline,
  ERROR,
  ExitAndLogError,
  getProjectSettings,
  LOG,
  PROJECT_MANIFEST_BASENAME,
  spinner,
} from '../utils';

/**
 * Deploys an Apps Script project.
 * @param cmd.versionNumber {string} The project version to deploy at.
 * @param cmd.description   {string} The deployment description.
 * @param cmd.deploymentId  {string} The deployment ID to redeploy.
 */
export default async (
  cmd: { versionNumber: number; description: string; deploymentId: string },
): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const settings = await getProjectSettings();
  const scriptId = settings?.scriptId;

  if (!scriptId) return;

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();
  let { versionNumber } = cmd;
  const { description = '', deploymentId } = cmd;

  // if no version, create a new version
  if (!versionNumber) {
    const version = await script.projects.versions.create({
      scriptId,
      requestBody: {
        description,
      },
    });
    if (spinner.isSpinning()) spinner.stop(true);
    if (version.status !== 200) {
      throw new ExitAndLogError(1, ERROR.ONE_DEPLOYMENT_CREATE);
    }

    versionNumber = version.data.versionNumber || 0;
    console.log(LOG.VERSION_CREATED(versionNumber));
  }

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
  let deployments;
  if (!deploymentId) {
    // if no deploymentId, create a new deployment
    deployments = await script.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: PROJECT_MANIFEST_BASENAME,
        description,
      },
    });
  } else {
    // if deploymentId, update deployment
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
  }

  if (spinner.isSpinning()) spinner.stop(true);
  if (deployments.status !== 200) {
    // logError(null, ERROR.DEPLOYMENT_COUNT);
    throw new ExitAndLogError(1, ERROR.DEPLOYMENT_COUNT);
  }

  console.log(`- ${deployments.data.deploymentId} @${versionNumber}.`);
};
