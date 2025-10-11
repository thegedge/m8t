import { parameterize as slugify, titleize, underscore } from "inflected";
import mime from "mime-types";
import path from "node:path";
import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const DATE_REGEX = /^(\d{4}).(\d{2}).(\d{2}).(.+)$/;

/**
 * A transformer that sets the `url` property on a data blob to the relative path of the file.
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
      if (path.basename(url).includes(".")) {
        outputPath = relativeUrl;
      } else if (url.endsWith("/index")) {
        outputPath = `${relativeUrl}.html`;
        url = url.replace(/\/index$/, "") || "/";
      } else {
        outputPath = `${relativeUrl}/index.html`;
      }
    }

    const mimeType: string | undefined = datum.maybeGetString("mimeType") || mime.lookup(url) || undefined;

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
