import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, ellipsize, isInteractive, openUrl} from './utils.js';

export const command = new Command('open-web-app')
  .arguments('[deploymentId]')
  .description('Open a deployed web app in the browser.')
  .action(async function (this: Command, deploymentId?: string): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const scriptId = clasp.project.scriptId;
    if (!scriptId) {
      this.error('Script ID not set. Unable to open IDE.');
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

      const answer = await inquirer.prompt([
        {
          choices: choices,
          message: 'Open which deployment?',
          name: 'deployment',
          type: 'list',
        },
      ]);

      deploymentId = answer.deployment;
    }

    if (!deploymentId) {
      this.error('Deployment ID is requrired.');
    }

    const entryPoints = await clasp.project.entryPoints(deploymentId);
    if (!entryPoints) {
      this.error('No entry points found.');
    }

    const webAppEntry = entryPoints.find(entryPoint => {
      return entryPoint.entryPointType === 'WEB_APP' && !!entryPoint.webApp?.url;
    });
    if (!webAppEntry || !webAppEntry.webApp?.url) {
      this.error('No web app entry point found.');
    }
    const url = webAppEntry.webApp.url;
    console.log(url);
    await openUrl(url);
  });
