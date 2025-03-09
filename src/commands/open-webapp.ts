import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {ellipsize, isInteractive, openUrl} from './utils.js';

export const command = new Command('open-web-app')
  .arguments('[deploymentId]')
  .description('Open a deployed web app in the browser.')
  .action(async function (this: Command, deploymentId?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const scriptId = clasp.project.scriptId;
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to open web app.',
      });
      this.error(msg);
    }

    if (!deploymentId && isInteractive()) {
      const deployments = await clasp.project.listDeployments();
      // Order deployments by update time.
      deployments.results.sort((a, b) => (a.updateTime && b.updateTime ? a.updateTime.localeCompare(b.updateTime) : 0));
      const choices = deployments.results.map(deployment => {
        const description = ellipsize(deployment.deploymentConfig?.description ?? '', 30);
        const versionNumber = (deployment.deploymentConfig?.versionNumber?.toString() ?? 'HEAD').padEnd(4);
        const name = `${description}@${versionNumber}} - ${deployment.deploymentId}`;
        return {
          name: name,
          value: deployment.deploymentId,
        };
      });

      const prompt = intl.formatMessage({
        defaultMessage: 'Open which deployment?',
      });
      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: prompt,
          name: 'deployment',
          type: 'list',
        },
      ]);

      deploymentId = answer.deployment;
    }

    if (!deploymentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Deployment ID is requrired.',
      });
      this.error(msg);
    }

    const entryPoints = (await clasp.project.entryPoints(deploymentId)) ?? [];

    const webAppEntry = entryPoints.find(entryPoint => {
      return entryPoint.entryPointType === 'WEB_APP' && !!entryPoint.webApp?.url;
    });

    if (!webAppEntry || !webAppEntry.webApp?.url) {
      const msg = intl.formatMessage({
        defaultMessage: 'No web app entry point found.',
      });
      this.error(msg);
    }

    const url = webAppEntry.webApp.url;
    await openUrl(url);
  });
