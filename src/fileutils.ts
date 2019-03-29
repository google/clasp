import {AppsScriptFile} from './files';
import * as recursive from 'recursive-readdir';

// https://developers.google.com/apps-script/api/reference/rest/v1/File#filetype
export enum APPS_SCRIPT_FILETYPE {
  ENUM_TYPE_UNSPECIFIED,
  SERVER_JS = 'SERVER_JS',
  HTML = 'HTML',
  JSON = 'JSON',
}

/**
 * Gets a list of all filepaths that are within the path.
 * Sorted alphabetically.
 * @param {string} rootDir The root directory. May be relative.
 * @returns {Promise<string[]>} A list of file paths.
 */
export const getFilePaths = async (rootDir: string): Promise<string[]> => {
  return new Promise((res, rej) => {
    recursive(rootDir, async (err, filePaths) => {
      if (err) return rej(err);
      filePaths = filePaths.sort();
      return res(filePaths);
    });
  });
};

/**
 * Gets files in a specific push order.
 */
export const getFilesInPushOrder = async ({
  filePushOrder,
  nonIgnoredFilePaths,
  files,
}: {
  filePushOrder: string[],
  nonIgnoredFilePaths: string[],
  files: Array<AppsScriptFile | undefined>,
}) => {
  const file2path: Array<{ path: string; file: AppsScriptFile }> = [];
  filePushOrder.map(file => {
    console.log(`└─ ${file}`);
  });
  console.log('');
  nonIgnoredFilePaths = nonIgnoredFilePaths.sort((path1, path2) => {
    // Get the file order index
    let path1Index = filePushOrder.indexOf(path1);
    let path2Index = filePushOrder.indexOf(path2);
    // If a file path isn't in the filePushOrder array, set the order to +∞.
    path1Index = path1Index === -1 ? Number.POSITIVE_INFINITY : path1Index;
    path2Index = path2Index === -1 ? Number.POSITIVE_INFINITY : path2Index;
    return path1Index - path2Index;
  });
  // apply nonIgnoredFilePaths sort order to files
  files = (files as AppsScriptFile[]).sort((file1, file2) => {
    // Get the file path from file2path
    const path1 = file2path.find(e => e.file === file1);
    const path2 = file2path.find(e => e.file === file2);
    // If a file path isn't in the nonIgnoredFilePaths array, set the order to +∞.
    const path1Index = path1 ? nonIgnoredFilePaths.indexOf(path1.path) : Number.POSITIVE_INFINITY;
    const path2Index = path2 ? nonIgnoredFilePaths.indexOf(path2.path) : Number.POSITIVE_INFINITY;
    return path1Index - path2Index;
  });
  return files;
};
