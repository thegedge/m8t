import debug from "debug";
import { Search } from "../../../Search.js";
import type { MaybeArray, SingleProcessor } from "../../../index.js";
import { type Datum, type DatumShape } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const log = debug("m8t:search");
export const noIndex = Symbol.for("m8t:search:noIndex");

/**
 * A processor that computes the reading time of the content.
 */
export class SearchTransformer implements SingleProcessor {
  readonly #data: Datum[];
  readonly #search: Search;

  constructor(data: Datum[] = [], index = true) {
    this.#data = data;
    this.#search = new Search(this.#data);
  }

  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    if (!datum.get(noIndex) && !this.#data.includes(datum)) {
      this.#data.push(datum);
    }

    const search = datum.get("search");
    if (typeof search != "function") {
      return datum;
    }

    log("searching for %s", datum.get("filename"));
    const searchResult: DatumShape = await search(this.#search, datum.toRecord());
    return (
      datum
        .with(searchResult)
        // unset search, so we don't run it again
        .delete("search")
    );
  }
}
