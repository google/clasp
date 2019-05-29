import * as path from 'path';
import * as fs from 'fs-extra';

/** A path broken down into a `dir`ectory and a `base` filename */
export type SplitPath = Pick<path.ParsedPath, 'dir' | 'base'>;

export class VirtualFile {
  userDefinedPath: string | undefined;
  protected _defaultPath: SplitPath;

  /**
   * Handles a file which may not exists.
   * The file has a default path, which can be overridden by the `path` accessor.
   * The `resolve()` method implements specific rules to define the effective path of  of the virtual file.
   *
   * @param {SplitPath} defaultPath default path
   */
  constructor(defaultPath: SplitPath) {
    this._defaultPath = defaultPath;
  }

  /**
   * Returns the current (raw and unresolved) defined path of the virtual file.
   *
   * *Note: for most uses, prefer the `resolve()` method in order to retreive a file's path*
   *
   * @returns {string}
   */
  get path() {
    return this.userDefinedPath || path.join(this._defaultPath.dir, this._defaultPath.base);
  }

  /**
   * Sets the current (raw and unresolved) path of the virtual file.
   *
   * *Note: passing an empty string restores the default path*
   */
  set path(userDefinedPath: string ) {
    this.userDefinedPath = userDefinedPath;
  }

  /**
   * Returns the resolved directory of the virtual file.
   *
   * *Note: for most uses, prefer the `.resolve()` method in order to retreive a file's path*
   *
   * @returns {string}
   */
  get resolvedDir() {
    return path.dirname(this.resolve());
  }

  /**
   * Returns true if current path is the default.
   *
   * @returns {boolean}
   */
  isDefault() {
    return !this.userDefinedPath;
  }

  /**
   * Resolves the current active path
   *
   * @returns {string}
   */
  resolve() {
    return this.userDefinedPath
      ? resolvePath(this.userDefinedPath, this._defaultPath.base)
      : path.join(this._defaultPath.dir, this._defaultPath.base);
  }

  // TODO: consider hosting the `DOTFILE` function for simplicity sake.
}

/**
 * Attempts to resolve a path with the following rules:
 *
 * - if path exists and points to a file: use it as is
 * - if path exists and points to a directory: append the default base filename to the path
 * - if path partially resolves to an existing directory but base filename does not exists: use it as is
 * - otherwise throw an error
 *
 * @param {string} pathToResolve the path to resolve
 * @param {string} base the default base filename
 *
 * @returns {string}
 */
const resolvePath = (pathToResolve: string, base: string) => {
  if (fs.existsSync(pathToResolve)) {
    return appendBaseIfDirectory(pathToResolve, base);
  }
  const parsedPath = path.parse(pathToResolve);
  if (parsedPath.dir === '' || fs.lstatSync(parsedPath.dir).isDirectory()) {
    return pathToResolve; // assume fullpath to missing file
  }
  // TODO: improve support for unresolved paths
  throw new Error(`Unrecognized path ${pathToResolve}`);
};

/**
 * Attempts to resolve an **existing** path with the following rules:
 *
 * - if path points to a file: use it as is
 * - if path points to a directory: append the default base filename to the path
 * - otherwise throw an error
 *
 * @param {string} somePath the path to resolve
 * @param {string} base the default base filename
 *
 * @returns {string}
 */
const appendBaseIfDirectory = (somePath: string, base: string ) => {
  const stats = fs.lstatSync(somePath);
  if (stats.isFile()) return somePath;
  if (stats.isDirectory()) return path.join(somePath, base);
  throw new Error(`Unrecognized path ${somePath}`);
};
