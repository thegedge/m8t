import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";
import { merge } from "../../utils/merge.js";

/**
 * A processor that computes the reading time of the content.
 */
export class SearchTransformer implements Processor {
  async process(site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (typeof data.search != "function") {
      return;
    }

    const searchData = await data.search(site.search, data);
    return merge(data, searchData, { search: null });
  }
}
