import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A processor that computes the reading time of the content.
 */
export class SearchTransformer implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (typeof data.search != "function") {
      return;
    }

    const searchData = await data.search(this.site.pages.search, data);
    return {
      ...data,
      ...searchData,
      search: null,
    };
  }
}
