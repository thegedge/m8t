import * as esbuild from "esbuild";
import path from "node:path";
import type { PageData } from "../PageData.ts";
import type { Site } from "../Site.ts";
import type { Processor } from "./index.ts";
import { StringRenderer } from "./renderers/string.ts";

const JAVASCRIPT_FILE_REGEX = /\.[cm]?[jt]sx?$/;
const needsRender = Symbol("needsRender");

/**
 * A processor that collects many entrypoints and runs them through esbuild.
 *
 * This processor not only produces javascript files for the entrypoints, but also produces additional
 * chunks that load up all the libraries they reference.
 */
export class StaticJavascriptProcessor implements Processor {
  private entrypoints: string[] = [];
  private buildResult_: Promise<Map<string, esbuild.OutputFile> | null> | null = null;

  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (!JAVASCRIPT_FILE_REGEX.test(data.filename)) {
      return;
    }

    if (data.content) {
      return;
    }

    // TODO this processor needs to take a dual-pass approach, with the first pass collecting all
    //   of the entrypoints, and the second pass spitting out javascript (which includes the chunks)

    // TODO make it easier to not make every JS file an entrypoint
    const filename = data.filename;
    this.entrypoints.push(filename);

    const self = this;
    const url = toJSFile("/" + path.relative(this.site.pagesRoot.path, filename));

    return {
      ...data,
      url,
      mimeType: "text/javascript",
      content: async function* staticJavascriptContent() {
        const first = !self.buildResult_;

        const relativePath = toJSFile(path.relative(self.site.root.path, filename));
        const buildResult = await self.buildResult;
        if (!buildResult) {
          throw new Error(`could not build static JS bundle for ${filename}`);
        }

        const artifact = buildResult.get(relativePath);
        if (!artifact) {
          throw new Error(`could not find artifact for ${relativePath}`);
        }

        yield {
          url,
          content: artifact.text,
        };

        if (first) {
          const chunks = await self.chunks();
          for (const chunk of chunks) {
            const chunkName = path.basename(chunk.path);
            const url = path.join(self.publicPath, chunkName);
            yield {
              filename: chunkName,
              url,
              renderer: StringRenderer,
              outputPath: url,
              title: chunkName,
              date: new Date(),
              slug: chunkName,
              content: () => chunk.text,
            };
          }
        }
      },
    };
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
