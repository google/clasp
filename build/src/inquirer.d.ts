import { script_v1 as scriptV1 } from 'googleapis';
import type { ReadonlyDeep } from 'type-fest';
export declare type functionNameSource = (answers: {
    readonly functionName: string;
}, input?: string | undefined) => Promise<string[]>;
/**
 * Inquirer prompt for a functionName.
 * @returns {Promise<{ functionName: string }>} A promise for an object with the `functionName` property.
 */
export declare const functionNamePrompt: (source: functionNameSource) => Promise<{
    functionName: string;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
export interface DeploymentIdPromptChoice {
    name: string;
    value: scriptV1.Schema$Deployment;
}
/**
 * Inquirer prompt for a deployment Id.
 * @param {DeploymentIdChoice[]} choices An array of `DeploymentIdChoice` objects.
 * @returns {Promise<{ deploymentId: string }>} A promise for an object with the `deploymentId` property.
 */
export declare const deploymentIdPrompt: (choices: ReadonlyArray<ReadonlyDeep<DeploymentIdPromptChoice>>) => Promise<{
    deployment: scriptV1.Schema$Deployment;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
/**
 * Inquirer prompt for a project description.
 * @returns {Promise<{ description: string }>} A promise for an object with the `description` property.
 */
export declare const descriptionPrompt: () => Promise<{
    description: string;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
export interface PromptAnswers {
    doAuth: boolean;
    localhost: boolean;
}
/**
 * Inquirer prompt for overwriting a manifest.
 * @returns {Promise<{ overwrite: boolean }>} A promise for an object with the `overwrite` property.
 */
export declare const overwritePrompt: () => Promise<{
    overwrite: boolean;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
/**
 * Inquirer prompt for project Id.
 * @returns {Promise<{ projectId: string }>} A promise for an object with the `projectId` property.
 */
export declare const projectIdPrompt: () => Promise<{
    readonly projectId: string;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
export interface ScriptIdPrompt {
    name: string;
    value: string;
}
/**
 * Inquirer prompt for script Id.
 * @param {ScriptIdPrompt[]} fileIds An array of `ScriptIdPrompt` objects.
 * @returns {Promise<{scriptId: string;}>} A promise for an object with the `scriptId` property.
 */
export declare const scriptIdPrompt: (fileIds: ReadonlyArray<Readonly<ScriptIdPrompt>>) => Promise<{
    scriptId: string;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
/**
 * Inquirer prompt for script type.
 * @returns {Promise<{ type: string }>} A promise for an object with the `type` property.
 */
export declare const scriptTypePrompt: () => Promise<{
    type: string;
}> & {
    ui: import("inquirer/lib/ui/prompt");
};
