import { parameterize as slugify, titleize, underscore } from "inflected";
import path from "path";
import { type PageData } from "./index.ts";
import { normalizeUrl } from "./utils.ts";

const DATE_REGEX = /^(\d{4}).(\d{2}).(\d{2}).(.+)$/;

export const preparePageData = <DataT extends PageData = PageData>(
  filename: string,
  data: Partial<PageData>,
): PageData<DataT> => {
  const parsed = path.parse(filename);

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

  const title = data.title ?? titleize(underscore(parsed.name));
  return {
    ...data,
    url: normalizeUrl(url),
    outputPath,
    title,
    slug: data.slug ?? slugify(title || parsed.name),
    date: data.date ?? date,
  } as DataT;
};
