import type { Dirent } from "fs";
import { merge } from "lodash-es";
import path from "path";
import { isGeneratorFunction } from "util/types";
import { Filesystem } from "./Filesystem.ts";
import { readingTime } from "./plugins/reading_time.ts";
import { preparePageData } from "./preparePageData.ts";
import type { Renderer } from "./renderers/index.ts";

import type { Loader, LoadResult } from "./loaders/index.ts";
import { Search } from "./Search.ts";
import type { Site } from "./Site.ts";
import type { ContentFunction, PageData } from "./types.ts";
import { normalizeUrl } from "./utils.ts";

export type DataPopulatedPage<DataT extends PageData = PageData> = {
  loader: Loader<DataT>;
  renderer: Renderer<DataT>;
  filename: string;
  data: DataT;
  content: unknown;
};

export type RenderedPage<DataT extends PageData = PageData> = {
  filename: string;
  data: DataT;
  content: string;
  outputPath: string;
};

export class Pages<DataT extends PageData = PageData> {
  #search: Search<DataT>;
  #pages = new Map<string, DataPopulatedPage<DataT>>();
  #renderedPages = new Map<string, RenderedPage<DataT>>();

  private readonly pagesFs: Filesystem;
  private readonly layoutsFs: Filesystem;

  constructor(readonly site: Site<DataT>) {
    // TODO make these two subdirs configurable
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

    let content: string;
    let renderer = page.renderer;
    try {
      let contentResult =
        typeof page.content == "function"
          ? await page.content({
              data: page.data,
              search: this.#search,
            })
          : page.content;

      let data = page.data;
      let layout = page.data.layout;
      while (typeof layout == "string") {
        const layoutFile = path.join(this.layoutsFs.path, layout);
        const loader = this.site.loaderForFilename(layoutFile);
        const { data: layoutData, content: layoutContent } = await loader.load(layoutFile);
        const populatedLayoutData = preparePageData(layout, layoutData);

        data = merge({}, populatedLayoutData, data);

        contentResult = await layoutContent({
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

    const renderedPage: RenderedPage<DataT> = {
      ...page,
      content:
        !page.data.outputPath.endsWith(".html") || content.startsWith("<!DOCTYPE")
          ? content
          : `<!DOCTYPE html>\n${content}`,
      outputPath: page.data.outputPath,
    };

    this.#renderedPages.set(renderedPage.data.url, renderedPage);
    return renderedPage;
  }

  async init() {
    const dataMap = new Map<string, Partial<PageData>>();

    const initData = async (fileSystem: Filesystem, parentData: Partial<PageData>) => {
      const listing = await fileSystem.ls();
      const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
      if (dataFile) {
        try {
          const dataFilePath = path.join(fileSystem.path, dataFile.name);
          const loader = this.site.loaderForFilename(dataFilePath);
          const { data: sharedData } = await loader.load(dataFilePath);
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
              ? this.site.loaderForType(parentData.loader)
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
      let loader: Loader<DataT>;
      try {
        loader = parentData.loader ? this.site.loaderForType(parentData.loader) : this.site.loaderForFilename(filename);
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

            let content: ContentFunction<DataT>;
            if (typeof generatedContent == "function") {
              content = generatedContent;
            } else {
              content = () => generatedContent;
            }

            const populatedPage = await this.populatePageData(
              loader,
              { filename, content, data: loadResult.data },
              parentData,
              data,
            );
            this.#pages.set(populatedPage.data.url, populatedPage);
          }
        } else {
          const populatedPage = await this.populatePageData(loader, loadResult, parentData);
          this.#pages.set(populatedPage.data.url, populatedPage);
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
          this.#pages.set(additionalPageData.data.url, additionalPageData);
        }
      }
    }
  }

  private async populatePageData(
    loader: Loader<DataT>,
    loadResult: LoadResult<DataT>,
    parentData: Partial<PageData>,
    otherData?: Partial<PageData>,
  ): Promise<DataPopulatedPage<DataT>> {
    const relativePath = path.relative(this.pagesFs.path, loadResult.filename);
    const fullData = preparePageData<DataT>(relativePath, merge({}, parentData, loadResult.data, otherData));
    const contentResult = await loadResult.content({
      data: fullData,
      search: this.#search,
    });

    const nearlyPopulatedPage = {
      loader,
      filename: loadResult.filename,
      data: merge(fullData, readingTime(fullData, contentResult)),
      content: contentResult,
    };

    return {
      ...nearlyPopulatedPage,
      renderer: fullData.renderer
        ? this.site.rendererForType(fullData.renderer)
        : this.site.rendererForPage(nearlyPopulatedPage),
    };
  }
}
