import type { PropsWithChildren } from "react";
import { type PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";
import { merge } from "../../utils/merge.js";

/**
 * A transformer that can render a data's content into another.
 *
 * Will look for a `layout` value on a data blob, a string under a layouts directory, and
 * try to load and process that layout.
 */
export class LayoutTransformer implements Processor {
  private readonly layoutDir: string;

  /**
   * @param layoutDir - The directory containing the layouts, relative to the site root.
   */
  constructor(layoutDir: string) {
    this.layoutDir = layoutDir;
  }

  async process(site: Site, originalData: PageData): Promise<MaybeArray<PageData> | undefined> {
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

    return merge(layoutData, originalData, {
      layout: layoutData.layout,
      content,
      // REMOVE once merge is typed better
    } as unknown as PageData);
  }
}
