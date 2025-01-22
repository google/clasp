import {Command} from 'commander';
import {google} from 'googleapis';
import {PROJECT_MANIFEST_BASENAME as manifestFileName} from '../constants.js';
import {Context, assertAuthenticated, assertScriptSettings} from '../context.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, spinner, stopSpinner} from '../utils.js';

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
export async function deployCommand(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  const script = google.script({version: 'v1', auth: context.credentials});

  spinner.start(LOG.DEPLOYMENT_START(context.project.settings.scriptId));
  try {
    let versionNumber = options.versionNumber;
    // If no version, create a new version
    if (!versionNumber) {
      const res = await script.projects.versions.create({
        requestBody: {
          description: options.description ?? '',
        },
        scriptId: context.project.settings.scriptId,
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
        scriptId: context.project.settings.scriptId,
        deploymentId: options.deploymentId,
        requestBody: {
          deploymentConfig,
        },
      });
    } else {
      const res = await script.projects.deployments.create({
        scriptId: context.project.settings.scriptId,
        requestBody: deploymentConfig,
      });
      deploymentId = res.data.deploymentId;
    }
    console.log(`- ${deploymentId} @${versionNumber}.`);
  } finally {
    stopSpinner();
  }
}
