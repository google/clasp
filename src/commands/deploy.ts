import {google} from 'googleapis';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {PROJECT_MANIFEST_BASENAME as manifestFileName} from '../constants.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

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
export async function deployCommand(options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const script = google.script({version: 'v1', auth: oauth2Client});

  const {scriptId} = await getProjectSettings();
  if (!scriptId) {
    return;
  }

  spinner.start(LOG.DEPLOYMENT_START(scriptId));
  try {
    let versionNumber = options.versionNumber;
    // If no version, create a new version
    if (!versionNumber) {
      const res = await script.projects.versions.create({
        requestBody: {
          description: options.description ?? '',
        },
        scriptId,
      });
      versionNumber = res.data.versionNumber ?? 0;
      console.log(LOG.VERSION_CREATED(versionNumber));
    }

    const deploymentConfig = {
      description: options.description,
      manifestFileName,
      versionNumber,
    };

    let deploymentId: string | null | undefined = options.deploymentId;
    if (deploymentId) {
      await script.projects.deployments.update({
        scriptId,
        deploymentId: options.deploymentId,
        requestBody: {
          deploymentConfig,
        },
      });
    } else {
      const res = await script.projects.deployments.create({
        scriptId,
        requestBody: deploymentConfig,
      });
      deploymentId = res.data.deploymentId;
    }
    console.log(`- ${deploymentId} @${versionNumber}.`);
  } finally {
    stopSpinner();
  }
}
