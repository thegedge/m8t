import { transform, type Loader } from "esbuild";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path/posix";
import { pathToFileURL } from "node:url";

import type { SingleProcessor, Site } from "../../../index.js";
import type { Transpiler } from "../../../loader/ModuleLoader.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const loadedFor = Symbol.for("loadedFor");
const JS_OR_TS_FILE_REGEX = /\.m?[jt]sx?$/;

/**
 * A loader that imports TypeScript files as data.
 *
 * The default export is the content function, if it exists.
 */
export class TypescriptLoader implements SingleProcessor {
  transpilersFor(site: Site): Transpiler[] {
    return [(filename) => this.#compile(filename, site.isDevelopment)];
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

    if (process.features.typescript && (filename.endsWith(".ts") || filename.endsWith(".mts"))) {
      const source = await readFile(filename, "utf8");
      return stripTypeScriptTypes(source, {
        mode: "strip",
        sourceUrl: String(pathToFileURL(filename)),
      });
    }

    let loader: Loader;
    switch (path.extname(filename)) {
      case ".tsx":
      case ".mtsx":
        loader = "tsx";
        break;
      case ".jsx":
      case ".mjsx":
        loader = "jsx";
        break;
      case ".ts":
      case ".mts":
        loader = "ts";
        break;
      default:
        return undefined;
    }

    const source = await readFile(filename, "utf8");
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
