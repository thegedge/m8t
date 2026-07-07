import fs from "fs";
import pathModule from "path";

/**
 * A filesystem abstraction used by m8t.
 *
 * Note that all operations that take a path will assume that path is relative to the root of this filesystem.
 * Many operations may still work a-o-k if given an absolute path, but it's recommended to stick with relative paths.
 */
export class Filesystem {
  /** Absolute path of the root for this filesystem */
  readonly path: string;

  /**
   * Construct a new filesystem rooted at the given path.
   */
  constructor(path: string) {
    this.path = ensureEndSlash(
      pathModule.isAbsolute(path)
        ? path
        : pathModule.normalize(pathModule.join(process.cwd(), path)),
    );
  }

  /**
   * Change the root of this filesystem.
   *
   * @returns a new fileystem rooted at the given directory.
   */
  cd(root: string) {
    const dir = pathModule.isAbsolute(root) ? root : pathModule.join(this.path, root);
    if (!this.isDirectory(dir)) {
      throw new Error(`can't descend into a non-directory ${dir}`);
    }
    return new Filesystem(dir);
  }

  /**
   * Check whether or not the a path is a directory.
   *
   * @return `true` if the
   */
  isDirectory(dir: string) {
    return fs.statSync(dir).isDirectory();
  }

  /**
   * List all files under the root of the current filesystem.
   *
   * @param recursive - if `true`, recurse subdirectories to find files
   * @returns a list of the found files
   */
  async ls(recursive = false) {
    return await fs.promises.readdir(this.path, {
      withFileTypes: true,
      encoding: "utf-8",
      recursive,
    });
  }

  /**
   * Remove all files under this filesystem.
   */
  async clear() {
    await fs.promises.rm(this.path, { recursive: true, force: true });
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
    await fs.promises.copyFile(filesystem.absolute(path), this.absolute(path));
  }

  /**
   * Ensure the given path, relative to this FS, exists.
   *
   * If no path param is given, ensure that the root of this filesystem exists.
   *
   * @param path - the path to ensure (optional)
   */
  async ensureDir(path?: string) {
    await fs.promises.mkdir(path ? this.absolute(path) : this.path, { recursive: true });
  }

  /**
   * Read contents of a given file.
   *
   * @see `fs.promises.readFile`
   * @return the string contents of the file if utf8 encoding specified, otherwise a {@linkcode Buffer} containing the contents
   */
  async readFile(path: string, encoding: "utf-8" | "utf8"): Promise<string>;
  async readFile(path: string, encoding: BufferEncoding): Promise<string | Buffer | null> {
    try {
      return await fs.promises.readFile(this.absolute(path), encoding);
    } catch (e) {
      console.warn(`Failed to read file ${path}: ${e}`);
      return null;
    }
  }

  /**
   * Write contents to a given file.
   *
   * Ensures the parent directory exists.
   */
  async writeFile(path: string, contents: string) {
    await this.ensureDir(pathModule.dirname(path));
    await fs.promises.writeFile(this.absolute(path), contents);
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
    return pathModule.resolve(this.path, ...paths);
  }
}

const ensureEndSlash = (path: string) => (path.endsWith("/") ? path : path + "/");
