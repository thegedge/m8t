import type { PropsWithChildren } from "react";
import { type PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A transformer that can render a data's content into another.
 *
 * Will look for a `layout` value on a data blob, a string under a layouts directory, and
 * try to load and process that layout.
 */
export class LayoutTransformer implements Processor {
  /**
   * @param layoutDir - The directory containing the layouts, relative to the site root.
   */
  constructor(readonly layoutDir: string) {}

  async process(site: Site, originalData: PageData) {
    if (!originalData.layout || typeof originalData.layout !== "string") {
      return;
    }

    const layoutsFs = site.root.cd(this.layoutDir);
    const layoutFile = layoutsFs.absolute(originalData.layout);
    const layoutData = await site.pages.processOnce({ filename: layoutFile });
    if (!layoutData || Array.isArray(layoutData)) {
      return originalData;
    }

    const content = async (props: PropsWithChildren) => {
      if (typeof layoutData.content === "function") {
        return await layoutData.content({ ...props, children: originalData.content });
      } else {
        return await layoutData.content;
      }
    };

    return {
      ...layoutData,
      ...originalData,
      layout: layoutData.layout,
      content,
    };
  }
}
