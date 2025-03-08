import * as esbuild from "esbuild";
import path from "node:path";
import { StringRenderer } from "../renderers/string.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Loader, LoadResult } from "./index.ts";

const JAVASCRIPT_FILE_REGEX = /\.[cm]?[jt]sx?$/;

export class StaticJavascriptLoader<DataT extends PageData> implements Loader<DataT> {
  private entrypoints: string[] = [];
  private buildResult_: Promise<Map<string, esbuild.OutputFile> | null> | null = null;

  constructor(readonly site: Site) {}

  handles(filename: string): boolean {
    return JAVASCRIPT_FILE_REGEX.test(filename);
  }

  async load(filename: string) {
    // TODO make it easier to not make every JS file an entrypoint
    this.entrypoints.push(filename);

    return {
      filename,
      data: {
        url: "./" + toJSFile(path.basename(filename)),
      } as Partial<DataT>,
      content: async () => {
        const relativePath = toJSFile(path.relative(this.site.root.path, filename));
        const buildResult = await this.buildResult;
        if (!buildResult) {
          throw new Error(`could not build static JS bundle for ${filename}`);
        }

        const artifact = buildResult.get(relativePath);
        if (!artifact) {
          throw new Error(`could not find artifact for ${relativePath}`);
        }
        return artifact.text;
      },
    };
  }

  async afterInitialLoad(): Promise<LoadResult<DataT>[]> {
    const chunks = await this.chunks();
    return chunks.map((chunk) => {
      const chunkName = path.basename(chunk.path);
      const url = path.join(this.publicPath, chunkName);
      return {
        filename: chunkName,
        content: () => chunk.text,
        data: {
          url,
          renderer: StringRenderer,
          outputPath: url,
          title: chunkName,
          date: new Date(),
          slug: chunkName,
        } as unknown as PageData<DataT>,
      };
    });
  }

  private get publicPath() {
    // TODO pull this from the config
    return "/js";
  }

  private get buildResult() {
    this.buildResult_ ??= this.build();
    return this.buildResult_;
  }

  private async chunks(): Promise<esbuild.OutputFile[]> {
    const buildResult = await this.buildResult;
    if (!buildResult) {
      return [];
    }

    return Array.from(buildResult.values()).filter((output) => {
      return output.path.includes("/chunk-");
    });
  }

  private async build() {
    const result = await esbuild.build({
      entryPoints: this.entrypoints,
      absWorkingDir: this.site.root.path,
      outbase: this.site.root.path,
      outdir: this.site.out.path,
      publicPath: this.publicPath,
      target: "esnext",
      format: "esm",
      bundle: true,
      splitting: true,
      minify: !!process.env.PUBLISH,
      sourcemap: process.env.PUBLISH ? undefined : "inline",
      logLevel: "silent",
      write: false,
    });

    if (result.errors.length > 0) {
      throw new Error("Failed to build static bundle:\n\n" + result.errors.map((e) => e.text).join("\n"));
    }

    const mapping = new Map<string, esbuild.OutputFile>();
    for (const output of result.outputFiles) {
      mapping.set(path.relative(this.site.out.path, output.path), output);
    }
    return mapping;
  }
}

const toJSFile = (filename: string) => {
  return filename.replace(JAVASCRIPT_FILE_REGEX, ".js");
};
