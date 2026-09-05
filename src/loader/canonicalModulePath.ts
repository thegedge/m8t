import { fileURLToPath } from "node:url";

/**
 * Converts a module URL to a canonical absolute file path.
 *
 * Query string or fragment pieces of the URL are ignored in canonicalization.
 *
 * @returns the absolute path for `file://` URLs, or `undefined` otherwise
 *
 * @example
 * canonicalModulePath(undefined) === undefined
 *
 * @example
 * canonicalModulePath("") === undefined
 *
 * @example
 * canonicalModulePath("file:///this/is/a/file.txt") === "/this/is/a/file.txt"
 *
 * @example
 * canonicalModulePath("file:blah.txt#test?f=md&q=test") === "/blah.txt"
 *
 * @example
 * canonicalModulePath("https://example.com/some/file.md") === undefined
 */
export function canonicalModulePath(url: string | undefined): string | undefined {
  if (!url || !URL.canParse(url)) {
    return undefined;
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "file:") {
    return undefined;
  }

  parsed.search = "";
  parsed.hash = "";
  return fileURLToPath(parsed);
}
