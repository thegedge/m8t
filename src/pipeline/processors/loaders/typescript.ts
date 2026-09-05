import { transform, type Loader } from "esbuild";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path/posix";
import { pathToFileURL } from "node:url";

import type { SingleProcessor, Site } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const loadedFor = Symbol.for("loadedFor");
const JS_OR_TS_FILE_REGEX = /\.[mc]?[jt]sx?$/;

/**
 * A loader that imports TypeScript files as data.
 *
 * The default export is the content function, if it exists.
 */
export class TypescriptLoader implements SingleProcessor {
  init(site: Site): void {
    site.loader.use((filename) => this.#compile(filename, site.isDevelopment));
  }

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (datum.get(loadedFor) === filename) {
      return datum;
    }

    if (!JS_OR_TS_FILE_REGEX.test(filename)) {
      return datum;
    }

    const { default: defaultExport, ...otherData } = await context.site.loader.load(filename);
    return datum.with({
      ...otherData,
      content: otherData.content ?? defaultExport,
      [loadedFor]: filename,
    });
  }

  async #compile(filename: string, development = false) {
    if (!JS_OR_TS_FILE_REGEX.test(filename)) {
      return undefined;
    }

    const source = await readFile(filename, "utf8");
    if (process.features.typescript && (filename.endsWith(".ts") || filename.endsWith(".mts"))) {
      return stripTypeScriptTypes(source, {
        mode: "strip",
        sourceUrl: String(pathToFileURL(filename)),
      });
    }

    let loader: Loader;
    switch (path.extname(filename)) {
      case ".tsx":
        loader = "tsx";
        break;
      case ".jsx":
        loader = "jsx";
        break;
      case ".ts":
      case ".mts":
        loader = "ts";
        break;
      default:
        return undefined;
    }

    const { code } = await transform(source, {
      loader,
      jsx: "automatic",
      jsxDev: development,
      sourcemap: "inline",
      sourcefile: filename,
      format: "esm",
    });

    return code;
  }
}
