import { randomUUID } from "crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import os from "node:os";
import pathModule from "path";

import { InternalError } from "../errors/InternalError.js";
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
  /**
   * Create a new, uniquely named directory.
   *
   * It is highly recommended to use `await using` on the created filesystem to ensure it gets cleaned up.
   *
   * @param prefix - the prefix for the directory's name
   * @returns a new filesystem rooted at the created directory
   */
  static async temporary(prefix: string) {
    return new Filesystem(await mkdtemp(pathModule.join(os.tmpdir(), prefix)));
  }

  /** Absolute path of the root for this filesystem */
  readonly rootPath: string;

  /**
   * Construct a new filesystem rooted at the given path.
   */
  constructor(path: string) {
    this.rootPath = pathModule.resolve(process.cwd(), path);
  }

  /**
   * Whether or not a given entry exists under this root.
   *
   * If no path given, checks whether or not the root iteslf exists.
   */
  async exists(path?: string) {
    const pathToCheck = path === undefined ? this.rootPath : this.#normalizePath(path);
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
  async cd(path: string) {
    const normalizedRoot = this.#normalizePath(path);
    if (!(await this.isDirectory(normalizedRoot))) {
      throw new InternalError(`can't descend into a non-directory ${normalizedRoot}`);
    }
    return new Filesystem(normalizedRoot);
  }

  /**
   * Check whether or not the a path is a directory.
   *
   * @returns `true` if the given path is a directory, `false` otherwise
   */
  async isDirectory(path: string) {
    const normalizedDir = this.#normalizePath(path);
    return (await stat(normalizedDir)).isDirectory();
  }

  /**
   * List all files under the root of the current filesystem.
   *
   * Entries are sorted by their full path (plain string comparison, not locale-aware), so that the order is
   * deterministic regardless of the underlying filesystem or the current locale.
   *
   * @param recursive - if `true`, recurse subdirectories to find files
   * @returns a list of the found files
   */
  async ls(recursive = false) {
    const entries = await readdir(this.rootPath, {
      withFileTypes: true,
      encoding: "utf-8",
      recursive,
    });

    return entries
      .map((entry) => ({
        entry,
        key: pathModule.join(entry.parentPath, entry.name),
      }))
      .toSorted((a, b) => a.key.localeCompare(b.key))
      .map(({ entry }) => entry);
  }

  /**
   * Remove all files under this filesystem.
   */
  async clear() {
    await this.remove();
    await this.ensureDir();
  }

  /**
   * Copy a file from the given filesystem into this filesystem.
   *
   * @param filesystem - the filesystem to copy the file from
   * @param path - the path to the file to copy
   */
  async copyFileFrom(filesystem: Filesystem, path: string) {
    const normalizedPath = this.#normalizePath(path);
    await this.ensureDir(pathModule.dirname(normalizedPath));
    await copyFile(filesystem.absolute(path), normalizedPath);
  }

  /**
   * Ensure the given path, relative to this FS, exists.
   *
   * If no path param is given, ensure that the root of this filesystem exists.
   *
   * @param path - the path to ensure (optional)
   */
  async ensureDir(path?: string) {
    await mkdir(path === undefined ? this.rootPath : this.#normalizePath(path), {
      recursive: true,
    });
  }

  /**
   * Remove the given entry from.
   *
   * @param path - the path to remove, or the root if no path given
   */
  async remove(path?: string) {
    await rm(path === undefined ? this.rootPath : this.#normalizePath(path), { recursive: true });
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
    return await readFile(this.#normalizePath(path), encoding);
  }

  /**
   * Write contents to a given file.
   *
   * Ensures the parent directory exists.
   */
  async writeFile(
    path: string,
    contents:
      | string
      | NodeJS.ArrayBufferView
      | Iterable<string | NodeJS.ArrayBufferView>
      | AsyncIterable<string | NodeJS.ArrayBufferView>,
  ) {
    const normalizedPath = this.#normalizePath(path);
    await this.ensureDir(pathModule.dirname(normalizedPath));
    await writeFile(normalizedPath, contents);
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
    return this.#normalizePath(...paths);
  }

  /**
   * Replace the directory at the given path with the root of another filesystem, by renaming.
   *
   * The source filesystem should live on the same device as this one (e.g., come from {@link Filesystem.temporary}).
   * Whatever was previously at `path` is moved aside, then removed only after the source is in place. If
   * the source can't be moved into place, the previous contents are restored.
   *
   * @param path - the path, relative to this filesystem, to replace
   * @param source - the filesystem whose root will be moved to `path`
   */
  async replaceDir(path: string, source: Filesystem) {
    const relative = pathModule.isAbsolute(path)
      ? pathModule.relative(source.rootPath, path)
      : path;
    const target = this.#normalizePath(relative);
    const backup = `${target}.old-${randomUUID()}`;

    let hadPrevious = true;
    try {
      await rename(target, backup);
    } catch (e) {
      if (!isNoEntryError(e)) {
        throw e;
      }
      hadPrevious = false;
    }

    await this.ensureDir(path);
    await rename(source.rootPath, target);

    if (hadPrevious) {
      await rm(backup, { recursive: true, force: true });
    }
  }

  /** Destroy this filesystem by removing the root path from disk */
  async [Symbol.asyncDispose]() {
    await this.remove().catch(() => {});
  }

  /** Expands dots and ensures path is under the root path */
  #normalizePath(...paths: string[]) {
    const resolved = pathModule.resolve(this.rootPath, ...paths);
    return resolved.startsWith(this.rootPath) ? resolved : pathModule.join(this.rootPath, resolved);
  }
}
