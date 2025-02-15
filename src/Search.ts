import { DataPopulatedPage } from "./Pages";
import { PageData } from "./types";

export type SearchQuery = Record<string, unknown>;
export type SearchSort = readonly [string, "asc" | "desc"];

export class Search {
  #pages: Map<string, DataPopulatedPage>;

  constructor(pages: Map<string, DataPopulatedPage>) {
    this.#pages = pages;
  }

  pages<DataT = PageData>(query: SearchQuery, sort?: SearchSort): DataT[] {
    const filtered = Array.from(this.#pages.values()).filter((page) => {
      for (const [key, value] of Object.entries(query)) {
        if (page.data[key] != value) {
          return false;
        }
      }

      return true;
    });

    if (sort) {
      const [key, direction] = sort;
      filtered.sort((a, b) => {
        if (a.data[key] < b.data[key]) {
          return direction == "asc" ? -1 : 1;
        } else if (a.data[key] > b.data[key]) {
          return direction == "asc" ? 1 : -1;
        } else {
          return 0;
        }
      });
    }

    return filtered.map((p) => p.data as DataT);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  previousPage<DataT = PageData>(url: string, query: SearchQuery, sort?: SearchSort): DataT | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as DataT) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  nextPage<DataT = PageData>(url: string, query: SearchQuery, sort?: SearchSort): DataT | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as DataT) : null;
  }
}
