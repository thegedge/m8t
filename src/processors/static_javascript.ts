import * as esbuild from "esbuild";
import path from "node:path";
import type { PageData } from "../PageData.ts";
import type { Site } from "../Site.ts";
import type { MaybeArray, Processor } from "../index.ts";
import { StringRenderer } from "./renderers/string.ts";

const JAVASCRIPT_FILE_REGEX = /\.[cm]?[jt]sx?$/;

/**
 * A processor that collects many entrypoints and runs them through esbuild.
 *
 * This processor not only produces javascript files for the entrypoints, but also produces additional
 * chunks that load up all the libraries they reference.
 */
export class StaticJavascriptProcessor implements Processor {
  private entrypoints: string[] = [];
  private buildResult_: Promise<Map<string, esbuild.OutputFile> | null> | null = null;
  private readonly publicPath: string;

  /**
   * @param publicPath - The path to where the JavaScript files will be served.
   */
  constructor(publicPath: string) {
    this.publicPath = publicPath;
  }

  async process(site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (!JAVASCRIPT_FILE_REGEX.test(data.filename)) {
      return;
    }

    if (data.content) {
      return;
    }

    // TODO make it easier to not make every JS file an entrypoint
    const filename = data.filename;
    this.entrypoints.push(filename);

    const self = this;
    const url = toJSFile("/" + path.relative(site.pages.root.path, filename));

    return {
      ...data,
      url,
      mimeType: "text/javascript",
      content: async function* staticJavascriptContent() {
        await site.pages.idle;

        const first = !self.buildResult_;

        const relativePath = toJSFile(path.relative(site.root.path, filename));
        const buildResult = await self.buildResult(site);
        if (!buildResult) {
          throw new Error(`could not build static JS bundle for ${filename}`);
        }

        const artifact = buildResult.get(relativePath);
        if (!artifact) {
          throw new Error(`could not find artifact for ${relativePath}`);
        }

        yield {
          url,
          outputPath: url,
          content: artifact.text,
        };

        if (first) {
          const chunks = await self.chunks(site);
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

  private buildResult(site: Site) {
    this.buildResult_ ??= this.build(site);
    return this.buildResult_;
  }

  private async chunks(site: Site): Promise<esbuild.OutputFile[]> {
    const buildResult = await this.buildResult(site);
    if (!buildResult) {
      return [];
    }

    return Array.from(buildResult.values()).filter((output) => {
      return output.path.includes("/chunk-");
    });
  }

  private async build(site: Site) {
    const result = await esbuild.build({
      entryPoints: this.entrypoints,
      absWorkingDir: site.root.path,
      outbase: site.root.path,
      outdir: site.out.path,
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
      mapping.set(path.relative(site.out.path, output.path), output);
    }
    return mapping;
  }
}

const toJSFile = (filename: string) => {
  return filename.replace(JAVASCRIPT_FILE_REGEX, ".js");
};
