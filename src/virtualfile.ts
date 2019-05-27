import * as path from 'path';
import * as fs from 'fs-extra';

/** A path broken down into a `dir`ectory and a `base` filename */
export type SplitPath = Pick<path.ParsedPath, 'dir' | 'base'>;

export class VirtualFile {
  userDefinedPath: string | undefined;
  protected _defaultPath: SplitPath;

  /**
   * Handles a file which may not exists. With a default path (which can be overrid)
   *
   * @param {SplitPath} defaultPath default path
   */
  constructor(defaultPath: SplitPath) {
    const { dir, base } = defaultPath;
    this._defaultPath = { dir, base };
  }

  /**
   * Returns the current defined path
   */
  get path() {
    return this.userDefinedPath || path.join(this._defaultPath.dir, this._defaultPath.base);
  }

  /**
   * Sets the current path
   *
   * *Pro-tip: passing an empty string re-enable the default path*
   */
  set path(userDefinedPath: string ) {
    this.userDefinedPath = userDefinedPath;
  }

  /**
   * Returns true if current path is the default path
   */
  isDefault() {
    return !this.userDefinedPath;
  }

  /**
   * Attempts to resolve the current active path
   */
  resolve() {
    if (this.userDefinedPath) {
      return resolvePath(this.userDefinedPath, this._defaultPath.base);
    }
    return path.join(this._defaultPath.dir, this._defaultPath.base);
  }
}

/**
 * Attempts to resolve a path as follow:
 *
 * - path exists and points to a file: use it as is
 * - path exists and points to a directory: append the default base filename to the path
 * - path partially resolves to an existing directory but base filename does not exists: use it as is
 * - otherwise throw an error
 *
 * @param pathToResolve the path to resolve
 * @param base the default base filename
 */
export const resolvePath = (pathToResolve: string, base: string) => {
  if (fs.existsSync(pathToResolve)) {
    return appendBaseIfDirectory(pathToResolve, base);
  }
  const parsedPath = path.parse(pathToResolve);
  if (parsedPath.dir) {
    if (fs.existsSync(parsedPath.dir) && fs.lstatSync(parsedPath.dir).isDirectory()) {
      return pathToResolve; // assume fullpath to missing file
    }
  }
  throw new Error(`Unrecognized path ${pathToResolve}`);
};

/**
 * Attempts to resolve an **existing** path as follow:
 *
 * - path points to a file: use it as is
 * - path points to a directory: append the default base filename to the path
 * - otherwise throw an error
 *
 * @param somePath the path to resolve
 * @param base the default base filename
 */
const appendBaseIfDirectory = (somePath: string, base: string ) => {
  const stats = fs.lstatSync(somePath);
  if (stats.isFile()) {
    return somePath;
  }
  if (stats.isDirectory()) {
    return path.join(somePath, base);
  }
  throw new Error(`Unrecognized path ${somePath}`);
};
