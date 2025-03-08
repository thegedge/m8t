import type { Dirent } from "fs";
import { merge } from "lodash-es";
import path from "path";
import { isGeneratorFunction } from "util/types";
import { Filesystem } from "./Filesystem.ts";
import { readingTime } from "./plugins/reading_time.ts";
import { preparePageData } from "./preparePageData.ts";
import type { Renderer, RendererConstructor } from "./renderers/index.ts";

import type { Loader, LoaderConstructor } from "./loaders/index.ts";
import { Search } from "./Search.ts";
import type { Site } from "./Site.ts";
import type { ContentFunction, PageData } from "./types.ts";
import { normalizeUrl } from "./utils.ts";

export class Pages {
  #search: Search;
  #pages = new Map<string, PageData>();
  #renderedPages = new Map<string, PageData>();

  private readonly pagesFs: Filesystem;
  private readonly layoutsFs: Filesystem;

  constructor(readonly site: Site) {
    // TODO make these two subdirs configurable
    this.pagesFs = site.pagesRoot.cd("pages");
    this.layoutsFs = site.pagesRoot.cd("layouts");
    this.#search = new Search(this.#pages);
  }

  async page(url: string): Promise<PageData | undefined> {
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

    let content: string;
    let renderer = page.renderer as Renderer;
    try {
      let contentResult =
        typeof page.content == "function"
          ? await page.content({
              data: page,
              search: this.#search,
            })
          : page.content;

      let data = page;
      let layout = page.layout;
      while (typeof layout == "string") {
        const layoutFile = path.join(this.layoutsFs.path, layout);
        const loader = this.site.loaderForFilename(layoutFile);
        const { content: layoutContent, ...layoutData } = await loader.load(layoutFile);
        const populatedLayoutData = preparePageData(layout, layoutData);

        data = merge({}, populatedLayoutData, data);

        contentResult = await (layoutContent as any)({
          data,
          search: this.#search,
          children: contentResult,
        });

        layout = layoutData.layout;
      }

      content = await renderer.render(contentResult);
    } catch (error) {
      if (process.env.PUBLISH) {
        throw error;
      }

      content = error instanceof Error ? error.toString() : JSON.stringify(error, null, 2);
    }

    const outputPath = page.outputPath;
    if (!outputPath || typeof outputPath != "string") {
      throw new Error(`Page ${url} has no outputPath`);
    }

    return this.addPage({
      ...page,
      content:
        !outputPath.endsWith(".html") || content.startsWith("<!DOCTYPE") ? content : `<!DOCTYPE html>\n${content}`,
      outputPath,
    });
  }

  async init() {
    const dataMap = new Map<string, PageData>();

    const initData = async (fileSystem: Filesystem, parentData: PageData) => {
      const listing = await fileSystem.ls();
      const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
      if (dataFile) {
        try {
          const dataFilePath = path.join(fileSystem.path, dataFile.name);
          const loader = this.site.loaderForFilename(dataFilePath);
          const sharedData = await loader.load(dataFilePath);
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
            const filePath = path.join(fileSystem.path, entry.name);
            const loader = parentData.loader
              ? this.site.loaderForType(parentData.loader as LoaderConstructor)
              : this.site.loaderForFilename(filePath);
            await loader.load(filePath);
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
      let loader: Loader;
      try {
        loader = parentData.loader
          ? this.site.loaderForType(parentData.loader as LoaderConstructor)
          : this.site.loaderForFilename(filename);
      } catch (_error) {
        // TODO ignoring for now, but maybe some kind of way of filtering out files we shouldn't process
        //      or a mode to warn when files are unhandled
        return;
      }

      try {
        const loadResult = await loader.load(filename);

        if (isGeneratorFunction(loadResult.content)) {
          for await (const { content: generatedContent, ...data } of loadResult.content({
            data: parentData,
            search: this.#search,
          }) as unknown as AsyncGenerator<PageData>) {
            if (!data.url) {
              throw new Error("generator template didn't provide a url");
            }

            let content: ContentFunction;
            if (typeof generatedContent == "function") {
              content = generatedContent as ContentFunction;
            } else {
              content = () => generatedContent;
            }

            const populatedPage = await this.populatePageData(
              loader,
              { ...loadResult, filename, content },
              parentData,
              data,
            );
            this.addPage(populatedPage);
          }
        } else {
          const populatedPage = await this.populatePageData(loader, loadResult, parentData);
          this.addPage(populatedPage);
        }
      } catch (error) {
        console.error(`Error loading ${filename}`);
        console.error(error);
      }
    };

    await initData(this.pagesFs, {});
    await initPages(this.pagesFs);

    for (const loader of this.site.loaders) {
      const additionalPages = await loader.afterInitialLoad?.();
      if (additionalPages) {
        for (const additionalPage of additionalPages) {
          const additionalPageData = await this.populatePageData(loader, additionalPage, {});
          this.addPage(additionalPageData);
        }
      }
    }
  }

  private addPage(data: PageData): PageData {
    if (!data.url || typeof data.url !== "string") {
      throw new Error("Data is missing a url");
    }
    this.#pages.set(data.url, data);
    return data;
  }

  private async populatePageData(
    loader: Loader,
    data: PageData,
    parentData: PageData,
    otherData?: PageData,
  ): Promise<PageData> {
    const relativePath = path.relative(this.pagesFs.path, data.filename as string);
    const fullData = preparePageData(relativePath, merge({}, parentData, data, otherData));
    const contentResult = await (data.content as any)({
      data: fullData,
      search: this.#search,
    });

    const nearlyPopulatedPage = {
      ...merge(fullData, readingTime(fullData, contentResult)),
      loader,
      filename: data.filename,
      content: contentResult,
    };

    return {
      ...nearlyPopulatedPage,
      renderer: fullData.renderer
        ? this.site.rendererForType(fullData.renderer as RendererConstructor)
        : this.site.rendererForPage(nearlyPopulatedPage),
    };
  }
}
