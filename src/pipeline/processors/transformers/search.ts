import debug from "debug";
import pMap from "p-map";

import { Search } from "../../../site/Search.js";
import { type DatumShape, type Datum } from "../../Datum.js";
import type { ManyProcessor } from "../../index.js";
import type { DefaultContext } from "../../utils.js";

const log = debug("m8t:search");
export const noIndex = Symbol.for("m8t:search:noIndex");

/**
 * A processor that can process search functions in data.
 *
 * Data is processed in two phases:
 *  1. All data coming through this stage is added to the internal "index".
 *  2. Search functions in the data are processed.
 *
 * Typically this would come after initializers/loaders and transformers that inject defaults, but
 * before any form of rendering (even the content function transformer).
 *
 * If you use the layout transformer, you may want to include a single instance of this search transformer both
 * early in the regular pipeline, but also in the "sub pipeline" for layouts.
 */
export class SearchTransformer implements ManyProcessor {
  readonly #data: Datum[];
  readonly #search: Search;

  constructor() {
    this.#data = [];
    this.#search = new Search(this.#data);
  }

  async processMany(data: Datum[], _context: DefaultContext): Promise<Datum[]> {
    for (const datum of data) {
      if (!datum.get(noIndex) && !this.#data.includes(datum)) {
        this.#data.push(datum);
      }
    }

    const searchResults: [Datum, Partial<DatumShape> | null][] = await pMap(data, async (datum) => {
      const search = datum.get("search");
      if (typeof search != "function") {
        return [datum, null];
      }

      log("searching for %s", datum.get("filename"));
      return [
        // unset search, so we don't run it again
        datum.delete("search"),
        await search(this.#search, datum.toRecord()),
      ];
    });

    return searchResults.map(([datum, searchResult]) => {
      if (!searchResult) {
        return datum;
      }

      return datum.with(searchResult);
    });
  }
}
