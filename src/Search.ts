import type { Datum, DatumShape } from "./pipeline/Datum.js";

export type Query = {
  where: Record<string, unknown>;
  sort?: readonly [string, "asc" | "desc"];
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
    const filtered = this.#data.filter((page) => {
      for (const [key, value] of Object.entries(query.where)) {
        if (page.get(key) != value) {
          return false;
        }
      }
      return true;
    });

    if (query.sort) {
      // TODO support multiple sort keys
      const [key, direction] = query.sort;
      filtered.sort((a, b) => {
        const aVal: any = a.get(key);
        const bVal: any = b.get(key);
        if (aVal < bVal) {
          return direction == "asc" ? -1 : 1;
        } else if (aVal > bVal) {
          return direction == "asc" ? 1 : -1;
        } else {
          return 0;
        }
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
