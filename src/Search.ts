import type { Datum, DatumShape } from "./pipeline/Datum.js";
import type { Search as SearchInterface } from "./types.js";

export type Query = {
  where: Record<string, unknown>;
  sort?: readonly [string, "asc" | "desc"];
};

export class Search implements SearchInterface {
  readonly #data: readonly Datum[];

  constructor(data: readonly Datum[]) {
    this.#data = data;
  }

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

  async previousPage(url: string, query: Query): Promise<DatumShape | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as DatumShape) : null;
  }

  async nextPage(url: string, query: Query): Promise<DatumShape | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as DatumShape) : null;
  }
}
