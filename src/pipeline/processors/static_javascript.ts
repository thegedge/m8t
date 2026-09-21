import * as esbuild from "esbuild";
import path from "node:path";

import type { ManyProcessor } from "../../index.js";
import { partition } from "../../utils/partition.js";
import { Datum } from "../Datum.js";
import type { DefaultContext } from "../utils.js";

const JAVASCRIPT_FILE_REGEX = /\.[cm]?[jt]sx?$/;

/**
 * A processor that collects many JavaScript entrypoints and runs them through esbuild.
 *
 * This processor not only produces javascript files for the entrypoints, but also produces additional
 * chunks that load up all the libraries they reference.
 */
export class StaticJavascriptProcessor implements ManyProcessor {
  readonly #publicPath: string;

  /**
   * Constructs a static javascript processor.
   *
   * @param publicPath - The path to where the JavaScript files will be served.
   */
  constructor(publicPath: string) {
    this.#publicPath = publicPath;
  }

  async processMany(data: readonly Datum[], context: DefaultContext): Promise<readonly Datum[]> {
    const [jsData, nonJsData] = partition(data, (datum) => {
      const filename = datum.get("filename");
      return JAVASCRIPT_FILE_REGEX.test(filename);
    });

    let basePath = "";
    const entryPoints = jsData.map((datum) => {
      const filename = datum.get("filename");
      basePath ||= datum.get("basePath");
      return filename;
    });

    if (!basePath) {
      if (jsData.length > 0) {
        throw new Error("Could not find any base path in data");
      }

      return nonJsData;
    }

    const outPath = path.join(context.site.out.rootPath, "build");
    const buildResult = await this.build(context, basePath, entryPoints);
    return [
      ...nonJsData,
      ...buildResult.values().map((outputFile) => {
        const baseOutputPath = path.join(
          this.#publicPath,
          path.relative(outPath, toJSFile(outputFile.path)),
        );

        // TODO perhaps try to map some outputs to the original data. Chunks are brand new things though.
        return new Datum({
          basePath,
          filename: outputFile.path,
          outputPath: path.join(".", baseOutputPath),
          url: baseOutputPath,
          mimeType: "text/javascript",
          content: outputFile.text,
        });
      }),
    ];
  }

  private async build({ site }: DefaultContext, basePath: string, entryPoints: string[]) {
    // TODO not ideal to hardcode this
    const outdir = path.join(site.out.rootPath, "build");
    const result = await esbuild.build({
      entryPoints,
      absWorkingDir: basePath,
      outbase: basePath,
      outdir,
      publicPath: this.#publicPath,
      target: "esnext",
      format: "esm",
      bundle: true,
      splitting: true,
      minify: !site.isDevelopment,
      sourcemap: site.isDevelopment ? "inline" : undefined,
      logLevel: "silent",
      write: false,
    });

    if (result.errors.length > 0) {
      throw new Error(
        "Failed to build static bundle:\n\n" + result.errors.map((e) => e.text).join("\n"),
      );
    }

    const mapping = new Map<string, esbuild.OutputFile>();
    for (const output of result.outputFiles) {
      mapping.set(path.relative(outdir, output.path), output);
    }

    return mapping;
  }
}

const toJSFile = (filename: string) => {
  return filename.replace(JAVASCRIPT_FILE_REGEX, ".js");
};
