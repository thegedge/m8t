import { parameterize as slugify, titleize, underscore } from "inflected";
import mime from "mime-types";
import path from "node:path";

import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const DATE_REGEX = /^(\d{4})[^a-zA-Z0-9](\d{2})[^a-zA-Z0-9](\d{2}).(.+)$/;

/**
 * A transformer that defaults various common properties on a datum.
 *
 * If all of the properties below have been set, this transform passes the data through.
 * Otherwise, any properties that have yet to be set will be defaulted as described below.
 *
 * **`url`**
 *
 * The url the datum can be accessed at.
 *
 * This is computed as relative to the base path of the pipeline. The last segment of the URL is is
 * the base name of the file, unless it's a Markdown or Javascript file, in which case HTML output
 * is assumed and no `.html` suffix is added.
 *
 * If the resulting URL ends with `/index`, it is replaced with `/`.
 *
 * **`outputPath`**
 *
 * The path to which output should be written by the `build` command.
 *
 * This is equivalent to the `url` property in the case the URL contains an extension in the last
 * segment. Otherwise, an `.html` suffix is added to the URL. URLs ending in `/index` or `/` are
 * handled by setting the last segment to `index.html`.
 *
 * **`title`**
 *
 * A title for the datum.
 *
 * Defaults to a "titleized" base name of the file. That is, spans of non-alphanumeric characters
 * are replaced with a space and the first letter of the first word is capitalized.
 *
 * **`slug`**
 *
 * The slug of the file.
 *
 * Defaults to a "slugified" version of the title. That is, the title is lowercased and all
 * non-alphanumeric spans replaced with an hyphen.
 *
 * **`date`**
 *
 * A date for the datum, extracted from the filename in the format `YYYY-MM-DD-<name>`. Note that
 * the hyphen separator can be any non-alphanumeric character.
 *
 * @example
 * ```ts
 * {
 *   basePath: "src/pages",
 *   filename: "2025-02-03-my-post.md",
 * }
 *
 * // => {
 * //   url: "/2025-02-03-my-post",
 * //   outputPath: "2025-01-01-my-post.html",
 * //   title: "My post",
 * //   slug: "my-post",
 * //   date: new Date(2025, 1, 3),
 * // }
 * ```
 *
 *  * @example
 * ```ts
 * {
 *   basePath: "src/pages",
 *   filename: "games/rpgs/index.js",
 * }
 *
 * // => {
 * //   url: "/games/rpgs",
 * //   outputPath: "games/rpgs/index.html",
 * //   title: "Index",
 * //   slug: "index",
 * // }
 * ```
 *
 * @see
 */
export class PageDefaultsTransformer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const currentUrl = datum.maybeGetString("url");
    if (
      !currentUrl?.startsWith(".") &&
      datum.maybeGetString("outputPath") &&
      datum.maybeGetString("title") &&
      datum.maybeGetString("slug") &&
      datum.get("date") instanceof Date
    ) {
      // Everything is already set, so we don't need to do anything
      return datum;
    }

    const basePath = datum.stringOrThrow("basePath");
    const filename = datum.stringOrThrow("filename");
    const relativePath = path.relative(basePath, filename);
    const parsed = path.parse(relativePath);

    // TODO if an index file, maybe it would be good to derive names/titles from the parent directory
    let name: string;

    // Maybe parse out the date from the prefix of the filename
    let date: Date | null = null;
    const dateMatch = DATE_REGEX.exec(parsed.name);
    if (dateMatch) {
      const [_, year, month, day, rest] = dateMatch;
      date = new Date(Number(year), Number(month) - 1, Number(day));
      name = `${year}-${month}-${day}-${rest}`;
    } else {
      switch (parsed.ext) {
        case ".mdx":
        case ".md":
        case ".js":
        case ".jsx":
        case ".cjs":
        case ".cjsx":
        case ".mjs":
        case ".mjsx":
        case ".ts":
        case ".tsx":
        case ".cts":
        case ".ctsx":
        case ".mts":
        case ".mtsx":
          name = parsed.name;
          break;
        default:
          name = parsed.base;
          break;
      }
    }

    let url: string;
    if (!currentUrl) {
      url = path.join("/", parsed.dir, name);
    } else if (currentUrl.startsWith(".")) {
      url = path.join("/", parsed.dir, currentUrl);
    } else {
      url = currentUrl;
    }

    // Figure out the output path from the URL, unless one given. If can't be inferred, assume it's html.
    let outputPath = datum.maybeGetString("outputPath");
    if (!outputPath) {
      const relativeUrl = path.join(".", url);
      if (path.extname(url) != "") {
        outputPath = relativeUrl;
      } else if (url.endsWith("/index")) {
        outputPath = `${relativeUrl}.html`;
        url = url.replace(/\/index$/, "") || "/";
      } else {
        outputPath = `${relativeUrl}/index.html`;
      }
    }

    const mimeType: string | undefined =
      datum.maybeGetString("mimeType") || mime.lookup(url) || undefined;

    const dataTitle = datum.maybeGetString("title");
    const title = dataTitle ?? titleize(underscore(parsed.name));

    let slug = datum.maybeGetString("slug");
    if (!slug) {
      slug = slugify(typeof title == "string" ? title || parsed.name : parsed.name);
    }

    return datum.with({
      url,
      outputPath,
      title,
      mimeType,
      slug,
      date,
    });
  }
}
