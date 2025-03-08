import type { DataPopulatedPage } from "./Pages.ts";
import type { PageData } from "./types.ts";

export type SearchQuery = Record<string, unknown>;
export type SearchSort = readonly [string, "asc" | "desc"];

export class Search<DataT extends PageData = PageData> {
  #pages: Map<string, DataPopulatedPage<DataT>>;

  constructor(pages: Map<string, DataPopulatedPage<DataT>>) {
    this.#pages = pages;
  }

  pages(query: SearchQuery, sort?: SearchSort): DataT[] {
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

    return filtered.map((p) => p.data);
  }

  previousPage(url: string, query: SearchQuery, sort?: SearchSort): DataT | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as DataT) : null;
  }

  nextPage(url: string, query: SearchQuery, sort?: SearchSort): DataT | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as DataT) : null;
  }
}
