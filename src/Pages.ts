import type { Dirent } from "fs";
import { merge } from "lodash-es";
import path from "path";
import { isGeneratorFunction } from "util/types";
import { Filesystem } from "./Filesystem.ts";
import { readingTime } from "./plugins/reading_time.ts";
import { preparePageData } from "./preparePageData.ts";
import type { ContentFunction, Processor, StaticJavascriptProcessor } from "./processors/index.ts";

import { Search } from "./Search.ts";
import type { Site } from "./Site.ts";
import type { PageData } from "./types.ts";
import { normalizeUrl } from "./utils.ts";

export type Page = {
  processor: Processor;
  filename: string;
  data: Partial<PageData>;
  content: ContentFunction;
};

export type DataPopulatedPage = {
  processor: Processor;
  filename: string;
  data: PageData;
  content: ContentFunction;
};

export type RenderedPage = {
  filename: string;
  data: PageData;
  content: string;
  outputPath: string;
};

export class Pages<DataT extends PageData = PageData> {
  #search: Search;
  #pages = new Map<string, DataPopulatedPage>();
  #renderedPages = new Map<string, RenderedPage>();

  private readonly pagesFs: Filesystem;
  private readonly layoutsFs: Filesystem;

  constructor(readonly site: Site<DataT>) {
    this.pagesFs = site.pagesRoot.cd("pages");
    this.layoutsFs = site.pagesRoot.cd("layouts");
    this.#search = new Search(this.#pages);
  }

  async page(url: string): Promise<RenderedPage | undefined> {
    url = normalizeUrl(url);

    let page = this.#renderedPages.get(url);
    if (!page) {
      page = await this.renderPage(url);
    }

    if (page) {
      this.#renderedPages.set(url, page);
    }

    return page;
  }

  urls(): string[] {
    return Array.from(this.#pages.keys());
  }

  private async renderPage(url: string) {
    const page = this.#pages.get(url);
    if (!page) {
      return undefined;
    }

    const data = page.data;
    let content: string;
    let processor = page.processor;

    try {
      let contentResult = await page.content({
        data: page.data,
        search: this.#search,
      });

      let data = page.data;
      let layout = page.data.layout;
      while (typeof layout == "string") {
        processor = this.site.processorForFile(layout);
        const layoutFile = path.join(this.layoutsFs.path, layout);
        const { data: layoutData, content } = await processor.load(layoutFile);

        data = merge({}, data, layoutData);

        contentResult = content({
          data,
          search: this.#search,
          children: contentResult,
        });

        layout = layoutData.layout;
      }

      content = await processor.render(contentResult);
    } catch (error) {
      if (process.env.PUBLISH) {
        throw error;
      }

      content = error instanceof Error ? error.toString() : JSON.stringify(error, null, 2);
    }

    const renderedPage: RenderedPage = {
      ...page,
      content:
        !page.data.outputPath.endsWith(".html") || content.startsWith("<!DOCTYPE")
          ? content
          : `<!DOCTYPE html>\n${content}`,
      outputPath: page.data.outputPath,
    };

    this.#renderedPages.set(data.url, renderedPage);
    return renderedPage;
  }

  async init() {
    const dataMap = new Map<string, Partial<PageData>>();

    const initData = async (fileSystem: Filesystem, parentData: Partial<PageData>) => {
      const listing = await fileSystem.ls();
      const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
      if (dataFile) {
        try {
          const processor = this.site.processorForFile(dataFile.name);
          const { data: sharedData } = await processor.load(path.join(fileSystem.path, dataFile.name));
          parentData = merge({}, parentData, sharedData);
        } catch (error) {
          console.error(`Error loading _data from ${fileSystem.path}`);
          console.error(error);
        }
      }

      dataMap.set(fileSystem.path, parentData);

      for (const entry of listing) {
        if (entry.name.startsWith(".") || entry.name.startsWith("_data.")) {
          // hidden files and directories
          continue;
        }

        if (entry.isDirectory()) {
          await initData(fileSystem.cd(entry.name), parentData);
        } else {
          try {
            const processor = parentData.processor
              ? this.site.processorForType(parentData.processor)
              : this.site.processorForFile(entry.name);
            await processor.load(path.join(fileSystem.path, entry.name));
          } catch (error) {
            console.error(`Error loading ${entry.name} from ${fileSystem.path}`);
            console.error(error);
          }
        }
      }
    };

    const initPages = async (fileSystem: Filesystem) => {
      const listing = await fileSystem.ls();
      for (const entry of listing) {
        if (entry.isDirectory()) {
          await initPages(fileSystem.cd(entry.name));
        } else {
          await processFile(fileSystem.path, entry);
        }
      }
    };

    const processFile = async (root: string, entry: Dirent) => {
      if (entry.name.startsWith("_data")) {
        return;
      }

      const parentData = dataMap.get(root) ?? {};
      const filename = path.join(root, entry.name);
      let processor: Processor;
      try {
        processor = parentData.processor
          ? this.site.processorForType(parentData.processor)
          : this.site.processorForFile(filename);
      } catch (_error) {
        // TODO ignoring for now, but maybe some kind of way of filtering out files we shouldn't process
        //      or a mode to warn when files are unhandled
        return;
      }

      try {
        const { data: processorData, content } = await processor.load(filename);
        const relativePath = path.relative(this.pagesFs.path, filename);

        if (isGeneratorFunction(content)) {
          for await (const { content: generatedContent, ...data } of content({
            data: parentData,
            search: this.#search,
          }) as unknown as AsyncGenerator<PageData>) {
            if (!data.url) {
              throw new Error("generator template didn't provide a url");
            }

            let content: ContentFunction;
            if (typeof generatedContent == "function") {
              content = generatedContent;
            } else {
              content = () => generatedContent;
            }

            const fullData = preparePageData(relativePath, merge({}, parentData, processorData, data));

            // FIXME can we do this reading time thing without it being so hardcoded in here?
            const contentResult = content({
              data: fullData,
              search: this.#search,
            });

            this.#pages.set(fullData.url, {
              processor,
              filename,
              data: merge({}, fullData, readingTime(data, contentResult)),
              content,
            });
          }
        } else {
          const fullData = preparePageData(relativePath, merge({}, parentData, processorData));
          const contentResult = content({
            data: fullData,
            search: this.#search,
          });

          this.#pages.set(fullData.url, {
            processor,
            filename,
            data: merge({}, fullData, readingTime(fullData, contentResult)),
            content,
          });
        }
      } catch (error) {
        console.error(`Error loading ${filename}`);
        console.error(error);
      }
    };

    await initData(this.pagesFs, {});
    await initPages(this.pagesFs);

    // TODO introduce hooks so this doesn't have to be here
    // TODO Make it so this doesn't have to be typed this way
    const { StaticJavascriptProcessor } = await import("./processors/static-javascript.ts");
    const processor = this.site.processorForType(StaticJavascriptProcessor as any) as StaticJavascriptProcessor<DataT>;
    const chunks = await processor.chunks();
    for (const chunk of chunks) {
      const chunkName = path.basename(chunk.path);
      const url = path.join("/js", chunkName);
      this.#pages.set(url, {
        processor,
        content: () => chunk.text,
        filename: chunkName,
        data: {
          url,
          outputPath: url,
          title: chunkName,
          date: new Date(),
          slug: chunkName,
        },
      });
    }
  }
}
