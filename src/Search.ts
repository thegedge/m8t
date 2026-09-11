import type { Datum, DatumShape } from "./pipeline/Datum.js";
import { deepCompare } from "./utils/deepCompare.js";
import { scalarCompare } from "./utils/scalarCompare.js";

/**
 * A search query.
 */
export type Query = {
  /**
   * A mapping from key to the value to be searched.
   *
   * @example
   * ```ts
   * { type: "post" }
   * ```
   */
  where?: Record<string, unknown>;

  /** How to sort the results of the query. */
  sort?: readonly [field: string, direction: "asc" | "desc"];
};

/**
 * The public search surface exposed to a page's search function. Implemented by {@link Search}.
 */
export interface Searcher {
  /** Find all data matching the given query. */
  pages(query: Query): Promise<DatumShape[]>;

  /** Find the datum before the one with the given URL within the query results. */
  previous(url: string, query: Query): Promise<DatumShape | null>;

  /** Find the datum after the one with the given URL within the query results. */
  next(url: string, query: Query): Promise<DatumShape | null>;
}

/**
 * A search interface for querying data in a pipeline.
 */
export class Search implements Searcher {
  readonly #data: readonly Datum[];

  constructor(data: readonly Datum[]) {
    this.#data = data;
  }

  /**
   * Find all data matching the given query.
   *
   * @returns a list of the data matching the given query.
   */
  async pages(query: Query): Promise<DatumShape[]> {
    const entries = query.where ? Object.entries(query.where) : [];
    const filtered =
      entries.length == 0
        ? [...this.#data]
        : this.#data.filter((page) => {
            return entries.every(
              ([key, value]) => page.has(key) && deepCompare(value, page.get(key)) == 0,
            );
          });

    if (query.sort) {
      // TODO support multiple sort keys
      const [key, direction] = query.sort;
      const COMPARE = direction == "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const aVal: any = a.get(key);
        const bVal: any = b.get(key);
        return COMPARE * scalarCompare(aVal, bVal);
      });
    }

    return filtered.map((datum) => datum.toProxy());
  }

  /**
   * Find a datum with a given URL after the data has been filtered by a given query, and return the page before it.
   *
   * @returns the datum before the given; or `null` if no pages found, or no page is found with the given URL in the query results, otherwise
   */
  async previous(url: string, query: Query): Promise<DatumShape | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as DatumShape) : null;
  }

  /**
   * Find a datum with a given URL after the data has been filtered by a given query, and return the page after it.
   *
   * @returns the datum after the given; or `null` if no pages found, or no page is found with the given URL in the query results, otherwise
   */
  async next(url: string, query: Query): Promise<DatumShape | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as DatumShape) : null;
  }
}
