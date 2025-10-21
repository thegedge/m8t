import * as esbuild from "esbuild";
import path from "node:path";
import type { ManyProcessor } from "../../index.js";
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
    let basePath = "";
    const entryPoints: string[] = [];
    for (const datum of data) {
      const filename = datum.get("filename");
      if (!JAVASCRIPT_FILE_REGEX.test(filename)) {
        continue;
      }

      basePath ||= datum.get("basePath");
      entryPoints.push(filename);
    }

    if (!basePath) {
      throw new Error("Could not find any base path in data");
    }

    const buildResult = await this.build(context, basePath, entryPoints);
    return buildResult
      .values()
      .map((outputFile) => {
        const baseOutputPath = path.join(
          this.#publicPath,
          path.relative(context.site.out.path, toJSFile(outputFile.path)),
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
      })
      .toArray();
  }

  private async build({ site }: DefaultContext, basePath: string, entryPoints: string[]) {
    const result = await esbuild.build({
      entryPoints,
      absWorkingDir: site.root.path,
      outbase: basePath,
      outdir: site.out.path,
      publicPath: this.#publicPath,
      target: "esnext",
      format: "esm",
      bundle: true,
      splitting: true,
      minify: site.isDevelopment,
      sourcemap: site.isDevelopment ? "inline" : undefined,
      logLevel: "silent",
      write: false,
    });

    if (result.errors.length > 0) {
      throw new Error("Failed to build static bundle:\n\n" + result.errors.map((e) => e.text).join("\n"));
    }

    const mapping = new Map<string, esbuild.OutputFile>();
    for (const output of result.outputFiles) {
      mapping.set(path.relative(site.out.path, output.path), output);
    }

    return mapping;
  }
}

const toJSFile = (filename: string) => {
  return filename.replace(JAVASCRIPT_FILE_REGEX, ".js");
};
