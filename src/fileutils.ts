import * as fs from 'fs';
import * as path from 'path';
import * as recursive from 'recursive-readdir';
import * as ts from 'typescript';
import {DOT} from './dotfile';
import { getFileType } from './files';
import { ERROR, getProjectSettings, logError, spinner } from './utils';
const readMultipleFiles = require('read-multiple-files');
const ts2gas = require('ts2gas');
const findParentDir = require('find-parent-dir');

// An Apps Script API File
export interface AppsScriptAPIFile {
  name: string;
  type: string;
  source: string;
}

// A generic file interface.
export interface File {
  name: string;
  content: string;
}

/**
 * Gets a list of all files that are within the specified directory's folder.
 * @param {string} rootDir The base directory to get the file paths at.
 */
export async function getAllFilePaths(rootDir: string): Promise<string[]> {
  return new Promise<string[]>((res, rej) => {
    recursive(rootDir, async (err, filePaths) => {
      if (err) return rej(err);
      res(filePaths.sort());
    });
  });
}

/**
 * Filters out bad file paths.
 * Valid paths includes .ts, .gs, .html files.
 * Valid paths includes appsscript.json file.
 */
export async function getValidFilePaths(filePaths: string[]): Promise<string[]> {
  return filePaths.filter(filePath => {
    const ext = path.extname(filePath).toLowerCase();
    const isJSFile = ext === '.js' || ext === '.ts' || ext === '.gs';
    const isManifest = filePath === 'appsscript.json';
    // console.log(isJSFile, isManifest, filePath);
    return isJSFile || isManifest; // don't filter these files.
  });
}

/**
 * Gets the contents of a list of files.
 * @param {string[]} filePaths A list of file paths.
 */
export async function getFileContents(filePaths: string[]): Promise<File[]> {
  return new Promise<File[]>((res, rej) => {
    readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
      if (err) return rej(err);
      const o = contents.map((content: string, i: number) => {
        return {
          name: filePaths[i],
          content,
        };
      });
      res(o);
    });
  });
}

/**
 * Fixes OS specific path separator.
 * @param {Files[]} files The files to fix the path.
 */
export async function fixFilePaths(files: File[]): Promise<File[]> {
  files.map(f => {
    // Replace OS specific path separator to common '/' char for console output
    f.name = f.name.replace(/\\/g, '/');
  });
  return files;
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
 * Returns in tsconfig.json.
 * @returns {ts.TranspileOptions} if tsconfig.json not exists, return undefined.
 */
export function getTranspileOptions(): ts.TranspileOptions {
  const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
  const tsconfigPath = path.join(projectDirectory, 'tsconfig.json');
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
 * @param {ProjectFile[]} files A list of project files.
 * @see http://github.com/grant/ts2gas
 */
export async function transpileTsFiles(files: File[]): Promise<File[]> {
  // Load tsconfig
  const userTranspileOptions: ts.TranspileOptions = getTranspileOptions();
  return files.map((file: File) => {
    // File source
    const source = file.content;
    if (path.extname(file.name).toUpperCase() === '.TS') {
      file.content = ts2gas(source, userTranspileOptions);
    }
    return file;
  });
}

/**
 * Removes the extension from the name.
 */
export async function removeExtensionFromName(files: File[]): Promise<File[]> {
  return files.map((file: File) => {
    const ext = path.extname(file.name);
    const fileNameWithoutExt = file.name.slice(0, -ext.length);
    return {
      name: fileNameWithoutExt,
      content: file.content,
      type: getFileType(ext),
    };
  });
}

/**
 * Sorts files by push order.
 * @param {ProjectFile[]} ProjectFile A list of project files.
 */
export async function sortFilesByPushOrder(files: File[]): Promise<File[]> {
  // This statement customizes the order in which the files are pushed.
  // It puts the files in the setting's filePushOrder first.
  // This is needed because Apps Script blindly executes files in order of creation time.
  // The Apps Script API updates the creation time of files.
  const { filePushOrder } = await getProjectSettings();
  if (!filePushOrder) return files;
  console.log('Detected filePushOrder setting. Pushing these files first:');
  filePushOrder.map(file => {
    console.log(`└─ ${file}`);
  });
  console.log('');
  return files = files.sort((file1: File, file2: File) => {
    if (!filePushOrder) return 0; // TS complains
    // Get the file order index
    let path1Index = filePushOrder.indexOf(file1.name);
    let path2Index = filePushOrder.indexOf(file2.name);
    // If a file path isn't in the filePushOrder array, set the order to -∞.
    path1Index = path1Index === -1 ? Number.NEGATIVE_INFINITY : path1Index;
    path2Index = path2Index === -1 ? Number.NEGATIVE_INFINITY : path2Index;
    return path2Index - path1Index;
  });
}
