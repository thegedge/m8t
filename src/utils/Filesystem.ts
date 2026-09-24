import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import pathModule from "path";

import { isNoEntryError } from "./is.js";

// TODO allow there to be a "root" filesystem. Every `cd` will retain that root value
//      and all operations with absolute paths will be considered relative to that root,
//      not the operating system's actual root mount.

/**
 * A filesystem abstraction used by m8t.
 *
 * Note that all operations that take a path will assume that path is relative to the root of this filesystem.
 * Many operations may still work a-o-k if given an absolute path, but it's recommended to stick with relative paths.
 */
export class Filesystem {
  /** Absolute path of the root for this filesystem */
  readonly rootPath: string;

  /**
   * Construct a new filesystem rooted at the given path.
   */
  constructor(path: string) {
    this.rootPath = ensureEndSlash(pathModule.resolve(process.cwd(), path));
  }

  /**
   * Whether or not a given entry exists under this root.
   *
   * If no path given, checks whether or not the root iteslf exists.
   */
  async exists(path?: string) {
    const pathToCheck = path === undefined ? this.rootPath : pathModule.join(this.rootPath, path);
    try {
      return await stat(pathToCheck);
    } catch (e) {
      if (isNoEntryError(e)) {
        return false;
      }
      throw e;
    }
  }

  /**
   * Change the root of this filesystem.
   *
   * @returns a new filesystem rooted at the given directory.
   */
  async cd(root: string) {
    const resolvedRoot = pathModule.resolve(this.rootPath, root);
    if (!(await this.isDirectory(resolvedRoot))) {
      throw new Error(`can't descend into a non-directory ${resolvedRoot}`);
    }
    return new Filesystem(resolvedRoot);
  }

  /**
   * Check whether or not the a path is a directory.
   *
   * @returns `true` if the given path is a directory, `false` otherwise
   */
  async isDirectory(dir: string) {
    const resolvedDir = pathModule.resolve(this.rootPath, dir);
    return (await stat(resolvedDir)).isDirectory();
  }

  /**
   * List all files under the root of the current filesystem.
   *
   * @param recursive - if `true`, recurse subdirectories to find files
   * @returns a list of the found files
   */
  async ls(recursive = false) {
    return await readdir(this.rootPath, {
      withFileTypes: true,
      encoding: "utf-8",
      recursive,
    });
  }

  /**
   * Remove all files under this filesystem.
   */
  async clear() {
    await rm(this.rootPath, { recursive: true, force: true });
    await this.ensureDir();
  }

  /**
   * Copy a file from the given filesystem into this filesystem.
   *
   * @param filesystem - the filesystem to copy the file from
   * @param path - the path to the file to copy
   */
  async copyFileFrom(filesystem: Filesystem, path: string) {
    await this.ensureDir(pathModule.dirname(path));
    await copyFile(filesystem.absolute(path), this.absolute(path));
  }

  /**
   * Ensure the given path, relative to this FS, exists.
   *
   * If no path param is given, ensure that the root of this filesystem exists.
   *
   * @param path - the path to ensure (optional)
   */
  async ensureDir(path?: string) {
    await mkdir(path ? this.absolute(path) : this.rootPath, { recursive: true });
  }

  /**
   * Read contents of a given file.
   *
   * @returns the string contents of the file if utf8 encoding specified, otherwise a
   *          {@link buffer#Buffer} containing the contents.
   * @see `readFile`
   */
  async readFile(path: string, encoding: "utf-8" | "utf8"): Promise<string>;
  async readFile(path: string, encoding: BufferEncoding): Promise<string | Buffer> {
    return await readFile(this.absolute(path), encoding);
  }

  /**
   * Write contents to a given file.
   *
   * Ensures the parent directory exists.
   */
  async writeFile(path: string, contents: string) {
    await this.ensureDir(pathModule.dirname(path));
    await writeFile(this.absolute(path), contents);
  }

  /**
   * Convert the given set of paths into an absolute path.
   *
   * If some path in the array is an absolute path, it will be used as is. All relative paths following that path will
   * then be relative to that directory.
   *
   * If there are no absolute paths, all relative paths will get joined onto the root of this filesystem.
   *
   * @example
   * ```ts
   * this.absolute("foo", "bar", "baz") // => "<root>/foo/bar/baz"
   * this.absolute("foo", "/bar", "baz") // => "/bar/baz"
   * ```
   *
   * @returns the absolute path
   */
  absolute(...paths: string[]) {
    return pathModule.resolve(this.rootPath, ...paths);
  }
}

const ensureEndSlash = (path: string) => (path.endsWith("/") ? path : path + "/");
