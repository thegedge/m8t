import * as esbuild from "esbuild";
import path from "node:path";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Processor } from "./index.ts";

export class StaticJavascriptProcessor<DataT extends PageData> implements Processor<DataT> {
  private entrypoints: string[] = [];
  private buildResult_: Promise<Map<string, esbuild.OutputFile> | null> | null = null;

  constructor(readonly site: Site) {}

  reset(): void {
    this.buildResult_ = null;
  }

  async chunks(): Promise<esbuild.OutputFile[]> {
    const buildResult = await this.buildResult;
    if (!buildResult) {
      return [];
    }

    return Array.from(buildResult.values()).filter((output) => {
      return output.path.includes("/chunk-");
    });
  }

  handles(extension: string): boolean {
    return /^[mc]?[jt]s$/.test(extension);
  }

  async load(filename: string) {
    // TODO make it easier to not make every JS file an entrypoint
    this.entrypoints.push(filename);

    return {
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

  async render(content: string) {
    return content;
  }

  private get buildResult() {
    this.buildResult_ ??= this.build();
    return this.buildResult_;
  }

  private async build() {
    // TODO make the output paths more configurable
    // TODO make entrypoints configurable, so we only bun
    const result = await esbuild.build({
      entryPoints: this.entrypoints,
      absWorkingDir: this.site.root.path,
      outbase: this.site.root.path,
      outdir: this.site.out.path,
      publicPath: "/js",
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
  return filename.replace(/\.[cm]?[jt]sx?$/, ".js");
};
