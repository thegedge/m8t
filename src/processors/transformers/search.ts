import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { MaybeArray, Processor } from "../../index.ts";
import { merge } from "../../utils/merge.ts";

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
