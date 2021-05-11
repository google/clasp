import fs from 'fs-extra';
import path from 'path';

import {ClaspError} from './clasp-error.js';

/** A path broken down into a `dir`ectory and a `base` filename */
type BrokenPath = Pick<path.ParsedPath, 'dir' | 'base'>;

export class PathProxy {
  protected _default: BrokenPath;
  protected _userDefined: string | undefined;

  /**
   * Handles a path to a file.
   *
   * - Constructor requires a default path (directory and filename)
   * - Path can be overridden with the `path` accessor.
   * - The `resolve()` method implements specific rules to define the effective path to the proxied file.
   *
   * @param {BrokenPath} defaultPath default path
   */
  constructor(defaultPath: BrokenPath) {
    this._default = defaultPath;
  }

  /**
   * Returns the current (raw and unresolved) defined path to the proxied file.
   *
   * *Note: for most uses, prefer the `resolve()` method in order to retreive a file's path*
   *
   * @returns {string}
   */
  get path(): string {
    return this._userDefined ?? path.join(this._default.dir, this._default.base);
  }

  /**
   * Sets the current (raw and unresolved) path to the proxied file.
   *
   * *Note: passing an empty string restores the default path*
   */
  set path(userDefined: string) {
    this._userDefined = userDefined === path.join(this._default.dir, this._default.base) ? undefined : userDefined;
  }

  /**
   * Returns true if current path is the default.
   *
   * @returns {boolean}
   */
  isDefault(): boolean {
    return !this._userDefined || this._userDefined === path.join(this._default.dir, this._default.base);
  }

  /**
   * Returns the resolved directory to the proxied file.
   *
   * *Note: for most uses, prefer the `.resolve()` method in order to retreive a file's path*
   *
   * @returns {string}
   */
  get resolvedDir(): string {
    return path.dirname(this.resolve());
  }

  /**
   * Resolves the current active path
   *
   * @returns {string}
   */
  resolve(): string {
    return this._userDefined
      ? resolvePath(this._userDefined, this._default.base)
      : path.join(this._default.dir, this._default.base);
  }
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
 * @param {string} baseFilename the default base filename
 *
 * @returns {string}
 */
const resolvePath = (pathToResolve: string, baseFilename: string) => {
  if (fs.existsSync(pathToResolve)) {
    return appendBaseIfIsDirectory(pathToResolve, baseFilename);
  }

  const parsedPath = path.parse(pathToResolve);

  if (parsedPath.dir === '' || fs.lstatSync(parsedPath.dir).isDirectory()) {
    return pathToResolve; // Assume fullpath to missing file
  }

  // TODO: improve support for unresolved paths
  throw new ClaspError(`Unrecognized path ${pathToResolve}`);
};

/**
 * Attempts to resolve an **existing** path using the following rules:
 *
 * - if path exists and points to a file: use it as is
 * - if path exists and points to a directory: append the default base filename to the path
 * - otherwise throw an error
 *
 * @param {string} somePath the path to resolve
 * @param {string} baseFilename the default base filename
 *
 * @returns {string}
 */
const appendBaseIfIsDirectory = (somePath: string, baseFilename: string): string => {
  const stats = fs.lstatSync(somePath);

  if (stats.isFile()) {
    return somePath;
  }

  if (stats.isDirectory()) {
    return path.join(somePath, baseFilename);
  }

  // TODO: improve support for other stats types (stats.isSymbolicLink() ? )
  throw new ClaspError(`Unrecognized path ${somePath}`);
};
