import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { getSystemErrorName } from "node:util";

import { memoize } from "./memoize.js";

type Matcher = {
  /** The pattern to match against */
  pattern: string;

  /** Whether the pattern is an ignore pattern */
  isIgnorePattern: boolean;

  /** Whether the pattern is a directory pattern */
  onlyDirectories: boolean;

  /** Whether the pattern matches any segment of the path */
  matchAnySegment: boolean;

  /** Whether the pattern matches dot files */
  matchDotFiles: boolean;
};

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
   * If `true`, the matcher will match hidden files and directories (i.e., those that start with a dot).
   */
  dot: boolean;

  /**
   * The absolute path of the base directory to match paths against.
   *
   * For example, if `base` is `/Users/jane`, then the matcher will match `/Users/jane/file.txt`
   * but not `/Users/john/file.txt` if `*.txt` is an include pattern.
   *
   * @default `process.cwd()`
   */
  base: string;
};

/**
 * A utility class for matching file paths against a set of patterns.
 *
 * This class essentially implements similar logic to how {@linkcode https://git-scm.com/docs/gitignore|.gitignore}
 * files work, so read those docs for more information on specific syntax. Primarily:
 *
 *   1. Empty lines and lines starting with `#` are ignored.
 *   2. Lines starting with `!` are treated as negated patterns.
 *   3. Patterns containing a directory separator (`/`) are treated as anchored patterns, to a given base directory.
 *   4. A single `*` acts as a "match any character" within a path segment.
 *   5. `**` can match any number of path segments.
 *   6. The order of patterns matters. If the last pattern that matches is an ignore, the file does not match. Otherwise,
 *
 * @see {@linkcode Site} for an example of how to use this class.
 */
export class FileMatcher {
  /**
   * Create a {@linkcode FileMatcher} from the given options.
   *
   * @param options - The options to create the {@linkcode FileMatcher} from.
   *
   * @returns A {@linkcode FileMatcher} instance.
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
      matchers: filteredLines.map((include) => {
        // Only match on any segment of the path if there is either
        //   - no directory separator (i.e., the index of the separator is -1); or
        //   - the directory separator is the last character of the path.
        //
        // Otherwise, a directory separator in the middle and need to match against the base directory.
        const separatorIndex = include.indexOf("/");
        const matchAnySegment = separatorIndex == -1 || separatorIndex === include.length - 1;

        const ignore = include.startsWith("!");
        let pattern = ignore ? include.slice(1) : include;
        if (pattern.startsWith("/")) {
          // We do the `|| "*"` to handle the case where the pattern is just a directory separator,
          // which can be interpreted as matching the root or anything under it, just like `/stuff/`
          // would be interpreted as matching anything under the directory named "stuff".
          pattern = pattern.slice(1) || "*";
        }

        return {
          pattern: pattern.endsWith("/") ? pattern.slice(0, -1) : pattern,
          onlyDirectories: include.endsWith("/"),
          matchAnySegment,
          isIgnorePattern: ignore,
          matchDotFiles: options.dot ?? false,
        };
      }),
    });
  }

  readonly #matchers: readonly Matcher[];
  readonly #base: string;
  readonly #defaultReturn: boolean;

  /** @private */
  constructor(options: { base: string; matchers: readonly Matcher[] }) {
    this.#base = options.base.endsWith("/") ? options.base.slice(0, -1) : options.base;
    this.#matchers = options.matchers;

    // This bit isn't super obvious at first glance:
    //   - If there are no matchers at all, we'll match everything.
    //   - OPtherwise, match everything if there are only ignoring matchers. In other words, if there is some non-ignoring
    //     matcher we want to start with a non-match.
    this.#defaultReturn =
      this.#matchers.length == 0
        ? true
        : this.#matchers.every(({ isIgnorePattern }) => isIgnorePattern);
  }

  /**
   * Create a copy of this {@linkcode FileMatcher}'s rules but a different base directory.
   *
   * @param base - The base directory to match paths against.
   *
   * @returns A new {@linkcode FileMatcher} instance
   */
  public withBase(base: string): FileMatcher {
    return new FileMatcher({
      base,
      matchers: this.#matchers,
    });
  }

  /**
   * Match a given file path against the rules in this matcher.
   *
   * @see {@linkcode FileMatcher} for details on the matching logic.
   */
  public matches(filepath: string): boolean {
    let pathToCheck = path.isAbsolute(filepath) ? path.relative(this.#base, filepath) : filepath;

    // Path is outside of base, never match
    if (pathToCheck.startsWith("..")) {
      return false;
    }

    // If there are no matchers, then we always match (as long as the above check passes)
    if (this.#matchers.length == 0) {
      return true;
    }

    if (pathToCheck.startsWith("./")) {
      pathToCheck = pathToCheck.slice(2);
    }

    if (pathToCheck.endsWith("/")) {
      pathToCheck = pathToCheck.slice(0, -1);
    }

    const segments = pathToCheck.split("/");
    const pathIsDirectory = memoize(() => {
      try {
        return statSync(path.join(this.#base, pathToCheck)).isDirectory();
      } catch (error) {
        if (isNoEntryError(error)) {
          // If does not exist, assume it's a file
          return false;
        }
        throw error;
      }
    });

    return this.#matchers.reduce(
      (
        fileMatches,
        {
          pattern,
          matchAnySegment,
          onlyDirectories,
          isIgnorePattern,
          // TODO implement this
          // matchDotFiles
        },
      ) => {
        if (isIgnorePattern !== fileMatches) {
          // No need to check this pattern if either
          //   - previously did not match and this is an ignore pattern, or
          //   - previously did match and this is an include pattern.
          return fileMatches;
        }

        let matchResult: boolean;
        if (matchAnySegment) {
          matchResult = segments.some((segment, index) => {
            if (onlyDirectories && index == segments.length - 1) {
              return path.matchesGlob(segment, pattern) && pathIsDirectory();
            }

            return path.matchesGlob(segment, pattern);
          });
        } else {
          matchResult = path.matchesGlob(pathToCheck, pattern);
        }
        return isIgnorePattern ? !matchResult : matchResult;
      },
      this.#defaultReturn,
    );
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
