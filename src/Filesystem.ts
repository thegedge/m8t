import fs from "fs";
import pathModule from "path";

export class Filesystem {
  /** Absolute path of the root for this filesystem */
  readonly path: string;

  constructor(path: string) {
    this.path = ensureEndSlash(
      pathModule.isAbsolute(path) ? path : pathModule.normalize(pathModule.join(process.cwd(), path)),
    );
  }

  /**
   * Return a new fileystem rooted at the given directory.
   */
  cd(root: string) {
    const dir = pathModule.isAbsolute(root) ? root : pathModule.join(this.path, root);
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error(`can't descend into a non-directory ${dir}`);
    }
    return new Filesystem(dir);
  }

  /**
   * List all files under the root of the current filesystem.
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
   */
  async copyFileFrom(filesystem: Filesystem, path: string) {
    await this.ensureDir(pathModule.dirname(path));
    await fs.promises.copyFile(filesystem.absolute(path), this.absolute(path));
  }

  /**
   * Ensure the given path, relative to this FS, exists.
   */
  async ensureDir(path?: string) {
    await fs.promises.mkdir(path ? this.absolute(path) : this.path, { recursive: true });
  }

  /**
   * Read contents of a given file.
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
   * Join a given relative path with the root of this filesystem.
   */
  absolute(relativePath: string) {
    return pathModule.join(this.path, relativePath);
  }
}

const ensureEndSlash = (path: string) => (path.endsWith("/") ? path : path + "/");
