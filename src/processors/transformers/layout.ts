import type { Filesystem } from "../../Filesystem.ts";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A transformer that can render a data's content into another.
 *
 * Will look for a `layout` value on a data blob, a string under a layouts directory, and
 * try to load and process that layout.
 */
export class LayoutTransformer implements Processor {
  private layoutsFs: Filesystem;

  constructor(readonly site: Site) {
    // TODO make this configurable
    this.layoutsFs = site.pagesRoot.cd("../layouts");
  }

  async process(originalData: PageData) {
    if (!originalData.layout || typeof originalData.layout !== "string") {
      return;
    }

    return {
      filename: this.layoutsFs.absolute(originalData.layout),
      content: async (layoutData: PageData) => {
        let content: unknown;
        if (typeof layoutData.content === "function") {
          content = await layoutData.content({
            ...layoutData,
            ...originalData,
            layout: layoutData.layout,
          });
        } else {
          content = await layoutData.content;
        }

        return {
          ...layoutData,
          ...originalData,
          layout: layoutData.layout,
          content,
        };
      },
    };
  }
}
