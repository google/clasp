import * as fs from 'fs';
import * as path from 'path';
import * as recursive from 'recursive-readdir';
import * as ts from 'typescript';
import {DOT} from './dotfile';
import { ProjectFile } from './fileutils';
import { ERROR, getAPIFileType, logError, spinner } from './utils';
const readMultipleFiles = require('read-multiple-files');
const ts2gas = require('ts2gas');
const findParentDir = require('find-parent-dir');

// An Apps Script API File
export interface AppsScriptAPIFile {
  name: string;
  type: string;
  source: string;
}

// A file that may be ignored by the project.
export interface ProjectFile {
  fileContents: AppsScriptAPIFile;
  ignored: boolean;
}

/**
 * Gets a list of all files that are within the specified directory's folder.
 * @param {string} rootDir The base directory to get the file paths at.
 */
export async function getFilePaths(rootDir: string): Promise<string[]> {
  return new Promise<string[]>((res, rej) => {
    recursive(rootDir, async (err, filePaths) => {
      if (err) return rej(err);
      res(filePaths.sort());
    });
  });
}

/**
 * Gets the contents of a list of files.
 * @param {string[]} filePaths A list of file paths.
 */
export async function getFileContents(filePaths: string[]): Promise<string[]> {
  return new Promise<string[]>((res, rej) => {
    readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
      if (err) return rej(err);
      res(contents);
    });
  });
}

/**
 * Checks the file paths for files that would conflict when renaming ts/js to gs.
 * @param {boolean} filePaths Returns true if there are conflicting files. Logs the file name.
 */
export async function checkConflictingFilePaths(filePaths: string[]): Promise<boolean> {
  let abortPush = false;
  return new Promise<boolean>((res, rej) => {
    // Check if there are files that will conflict if renamed .gs to .js.
    // When pushing to Apps Script, these files will overwrite each other.
    filePaths.map((name: string) => {
      const fileNameWithoutExt = name.slice(0, -path.extname(name).length);
      if (
        filePaths.indexOf(fileNameWithoutExt + '.ts') !== -1 &&
        filePaths.indexOf(fileNameWithoutExt + '.js') !== -1 &&
        filePaths.indexOf(fileNameWithoutExt + '.gs') !== -1
      ) {
        // Can't rename, conflicting files
        abortPush = true;
        if (path.extname(name) === '.gs') {
          // only print error once (for .gs)
          logError(null, ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
        }
      }
    });
    res(abortPush);
  });
}

/**
 * Gets all files:
 * - Non-ignored files: Get the name and contents
 * - Ignored files: Get the name
 */
export async function getAllFiles({
  filePaths,
  fileContents,
  ignoredFilePaths,
  nonIgnoredFilePaths,
  ignoreMatches,
  rootDir,
}: {
  filePaths: string[],
  fileContents: string[],
  ignoredFilePaths: string[],
  ignoreMatches: string[],
  nonIgnoredFilePaths: string[],
  rootDir: string,
}): Promise<ProjectFile[]> {
  const files: Array<AppsScriptAPIFile | undefined> = filePaths.map((name, i) => {
    const normalizedName = path.normalize(name);
    const type = getAPIFileType(name);

    // Formats rootDir/appsscript.json to appsscript.json.
    // Preserves subdirectory names in rootDir
    // (rootDir/foo/Code.js becomes foo/Code.js)
    const formattedName = getAppsScriptFileName(rootDir, name);

    // If the file is valid, return the file in a format suited for the Apps Script API.
    if (isValidFileName({
      name,
      type,
      rootDir,
      normalizedName,
      ignoreMatches,
    })) {
      nonIgnoredFilePaths.push(name);
      const file: AppsScriptAPIFile = {
        name: formattedName, // the file base name
        type, // the file extension
        source: fileContents[i], //the file contents
      };
      return file;
    } else {
      ignoredFilePaths.push(name);
      return undefined; // Skip ignored files
    }
  });
  // Fixes TypeScript errors.
  function notEmpty<T>(value: T | undefined): value is T {
    return !!value;
  }
  const nonNullFiles: AppsScriptAPIFile[] = files.filter(notEmpty);
  const projectFilesList: ProjectFile[] = nonNullFiles.map((f: AppsScriptAPIFile) => {
    const projectFile: ProjectFile = {
      fileContents: {
        name: '',
        type: '',
        source: '',
      },
      ignored: false,
    };
    return projectFile;
  });
  return projectFilesList;
}

/**
 * Returns in tsconfig.json.
 * @returns {ts.TranspileOptions} if tsconfig.json not exists, return undefined.
 */
export function getTranspileOptions(): ts.TranspileOptions {
  const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
  const tsconfigPath = path.join(projectDirectory, 'tsconfig.json');
  const userConf: ts.TranspileOptions = {};
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    const parsedConfigResult = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigContent);
    return {
      compilerOptions: parsedConfigResult.config.compilerOptions,
    };
  }
  return {};
}

/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} rootDir The directory to save the project files to.
 * @param {string} filePath Path of file that is part of the current project
 */
export function getAppsScriptFileName(rootDir: string, filePath: string): string {
  const nameWithoutExt = filePath.slice(0, -path.extname(filePath).length);
  let fullFilePathNoExt = rootDir ? path.relative(rootDir, nameWithoutExt) : nameWithoutExt;
  // Replace OS specific path separator to common '/' char
  fullFilePathNoExt = fullFilePathNoExt.replace(/\\/g, '/');
  return fullFilePathNoExt;
}

/**
 * Transpiles TS files to GS
 * @param {ProjectFile[]} projectFiles A list of project files.
 * @see http://github.com/grant/ts2gas
 */
export function transpileTsFiles(projectFiles: ProjectFile[]): ProjectFile[] {
  // Load tsconfig
  const userTranspileOptions: ts.TranspileOptions = getTranspileOptions();
  return projectFiles.map((projectFile: ProjectFile) => {
    // File source
    const source = projectFile.fileContents.source;
    if (projectFile.fileContents.type === 'TS') {
      projectFile.fileContents.source = ts2gas(source, userTranspileOptions);
    }
    return projectFile;
  });
}

/**
 * Sorts files by push order.
 * @param {ProjectFile[]} ProjectFile A list of project files.
 */
export const sortFilesByPushOrder = (files: ProjectFile[], filePushOrder: string[]) => {
  // This statement customizes the order in which the files are pushed.
  // It puts the files in the setting's filePushOrder first.
  // This is needed because Apps Script blindly executes files in order of creation time.
  // The Apps Script API updates the creation time of files.
  spinner.stop(true);
  console.log('Detected filePushOrder setting. Pushing these files first:');
  filePushOrder.map(file => {
    console.log(`└─ ${file}`);
  });
  console.log('');
  return files = files.sort((file1: ProjectFile, file2: ProjectFile) => {
    // Get the file order index
    let path1Index = filePushOrder.indexOf(file1.fileContents.name);
    let path2Index = filePushOrder.indexOf(file2.fileContents.name);
    // If a file path isn't in the filePushOrder array, set the order to -∞.
    path1Index = path1Index === -1 ? Number.NEGATIVE_INFINITY : path1Index;
    path2Index = path2Index === -1 ? Number.NEGATIVE_INFINITY : path2Index;
    return path2Index - path1Index;
  });
};

/**
 * If the file is valid, add it to our file list.
 * We generally want to allow for all file types, including files in node_modules/.
 * However, node_modules/@types/ files should be ignored.
 */
const isValidFileName = ({
  name,
  type,
  rootDir,
  normalizedName,
  ignoreMatches,
}: {
  name: string,
  type: string,
  rootDir: string,
  normalizedName: string,
  ignoreMatches: string[],
}) => {
  let valid = true; // Valid by default, until proven otherwise.
  // Has a type or is appsscript.json
  let isValidJSONIfJSON = true;
  if (type === 'JSON') {
    if (rootDir) {
      isValidJSONIfJSON = normalizedName === path.join(rootDir, 'appsscript.json');
    } else {
      isValidJSONIfJSON = name === 'appsscript.json';
    }
  } else {
    // Must be SERVER_JS or HTML.
    // https://developers.google.com/apps-script/api/reference/rest/v1/File
    valid = type === 'SERVER_JS' || type === 'HTML';
  }
  const validType = type && isValidJSONIfJSON;
  const notIgnored = !ignoreMatches.includes(name);
  valid = !!(valid && validType && notIgnored);
  return valid;
};