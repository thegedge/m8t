import { parameterize as slugify, titleize, underscore } from "inflected";
import path from "path";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

const DATE_REGEX = /^(\d{4}).(\d{2}).(\d{2}).(.+)$/;

/**
 * A transformer that sets the `url` property on a data blob to the relative path of the file.
 */
export class PageDefaultsTransformer implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (
      typeof data.url == "string" &&
      !data.url.startsWith(".") &&
      typeof data.outputPath == "string" &&
      typeof data.title == "string" &&
      typeof data.slug == "string" &&
      "date" in data
    ) {
      // Everything is already set, so we don't need to do anything
      return;
    }

    const relativePath = path.relative(this.site.pagesRoot.path, data.filename);
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
    if (typeof data.url == "string") {
      if (data.url.startsWith(".")) {
        url = path.join("/", parsed.dir, data.url);
      } else {
        url = data.url;
      }
    } else {
      url = path.join("/", parsed.dir, name);
    }

    // Figure out the output path from the URL, unless one given. If can't be inferred, assume it's html.
    let outputPath: string;
    if (typeof data.outputPath == "string") {
      outputPath = data.outputPath;
    } else if (path.basename(url).includes(".")) {
      outputPath = url;
    } else if (url.endsWith("/index")) {
      outputPath = `${url}.html`;
      url = url.replace(/\/index$/, "") || "/";
    } else {
      outputPath = `${url}/index.html`;
    }

    const dataTitle = data.title;
    const title = dataTitle ?? titleize(underscore(parsed.name));
    return {
      ...data,
      url,
      outputPath,
      title,
      slug: data.slug ?? slugify(typeof title == "string" ? title || parsed.name : parsed.name),
      date: data.date ?? date,
    };
  }
}
