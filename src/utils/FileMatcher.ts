import ignore from "ignore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { getSystemErrorName } from "node:util";

export type FileMatcherOptions = {
  /**
   * Ignore files to match (e.g., `.gitignore`).
   *
   * Can be provided as a string or a readable stream.
   *   - If a string, it is assumed to be a file path relative to the given base directory. Ignored if the file does not exist.
   *   - If a readable stream, its encoding is set to utf8 and read in as a string.
   */
  files: readonly (string | Readable)[];

  /**
   * The globs to match. These always take precedence over the files.
   */
  globs: readonly string[];

  /**
   * The absolute path of the base directory to match paths against.
   *
   * For example, if `base` is `/Users/jane`, then the matcher will match `/Users/jane/file.txt`
   * but not `/Users/john/file.txt` if `*.txt` is an include pattern.
   *
   * @defaultValue `process.cwd()`
   */
  base: string;
};

/**
 * A utility class for matching file paths against a set of patterns.
 *
 * This class essentially implements similar logic to how {@link https://git-scm.com/docs/gitignore|.gitignore}
 * files work, so read those docs for more information on specific syntax. Primarily:
 *
 *   1. Empty lines and lines starting with `#` are ignored.
 *   2. Lines starting with `!` are treated as negated patterns.
 *   3. Patterns containing a directory separator (`/`) are treated as anchored patterns, to a given base directory.
 *   4. A single `*` acts as a "match any character" within a path segment.
 *   5. `**` can match any number of path segments.
 *   6. The order of patterns matters. If the last pattern that matches is an ignore, the file does not match. Otherwise,
 *
 * @see {@link Site} for an example of how to use this class.
 */
export class FileMatcher {
  /**
   * Create a {@link FileMatcher} from the given options.
   *
   * @param options - The options to create the {@link FileMatcher} from.
   *
   * @returns A {@link FileMatcher} instance.
   */
  static async fromOptions(options: Partial<FileMatcherOptions>): Promise<FileMatcher> {
    if (options.base && !options.base.startsWith("/")) {
      throw new Error("base must be an absolute path");
    }

    const base = options.base ?? process.cwd();
    const lines: string[] = [];

    if (options.files) {
      for (const file of options.files) {
        try {
          if (typeof file === "string") {
            const contents = await readFile(path.resolve(base, file), "utf8");
            lines.push(...contents.split("\n"));
          } else {
            file.setEncoding("utf8");

            let contents = "";
            for await (const chunk of file) {
              contents += chunk;
            }
            lines.push(...contents.split("\n"));
          }
        } catch (err) {
          if (!isNoEntryError(err)) {
            throw err;
          }
        }
      }
    }

    if (options.globs) {
      lines.push(...options.globs);
    }

    const filteredLines = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    return new FileMatcher({
      base,
      lines: filteredLines,
    });
  }

  readonly #matcher: ReturnType<typeof ignore>;
  readonly #lines: readonly string[];
  readonly #base: string;

  private constructor(options: { base: string; lines: readonly string[] }) {
    this.#base = options.base.endsWith("/") ? options.base.slice(0, -1) : options.base;
    this.#lines = options.lines;
    this.#matcher = ignore().add(options.lines);
  }

  /**
   * Create a copy of this {@link FileMatcher}'s rules but a different base directory.
   *
   * @param base - The base directory to match paths against.
   *
   * @returns A new {@link FileMatcher} instance
   */
  public withBase(base: string): FileMatcher {
    return new FileMatcher({
      base,
      lines: this.#lines,
    });
  }

  /**
   * Match a given file path against the rules in this matcher.
   *
   * @see {@link FileMatcher} for details on the matching logic.
   */
  public matches(filepath: string): boolean {
    let pathToCheck = path.isAbsolute(filepath) ? path.relative(this.#base, filepath) : filepath;

    if (pathToCheck.startsWith("..")) {
      // Path is outside of base, never match
      return false;
    }

    if (pathToCheck.startsWith("./")) {
      // `ignore` doesn't like `./`
      pathToCheck = pathToCheck.slice(2);
    }

    if (pathToCheck == "") {
      // Root path never matches
      return false;
    }

    return this.#matcher.ignores(pathToCheck);
  }
}

const isNoEntryError = (error: unknown): boolean => {
  return (
    Error.isError(error) &&
    "errno" in error &&
    typeof error.errno == "number" &&
    getSystemErrorName(error.errno) === "ENOENT"
  );
};
