import type { PageData } from "./PageData.ts";

export type SearchQuery = Record<string, unknown>;
export type SearchSort = readonly [string, "asc" | "desc"];

export class Search {
  #pages: Map<string, PageData>;

  constructor(pages: Map<string, PageData>) {
    this.#pages = pages;
  }

  pages(query: SearchQuery, sort?: SearchSort): PageData[] {
    const filtered = Array.from(this.#pages.values()).filter((page) => {
      for (const [key, value] of Object.entries(query)) {
        if (page[key] != value) {
          return false;
        }
      }
      return true;
    });

    if (sort) {
      const [key, direction] = sort;
      filtered.sort((a, b) => {
        const aVal: any = a[key];
        const bVal: any = b[key];
        if (aVal < bVal) {
          return direction == "asc" ? -1 : 1;
        } else if (aVal > bVal) {
          return direction == "asc" ? 1 : -1;
        } else {
          return 0;
        }
      });
    }

    return filtered;
  }

  previousPage(url: string, query: SearchQuery, sort?: SearchSort): PageData | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as PageData) : null;
  }

  nextPage(url: string, query: SearchQuery, sort?: SearchSort): PageData | null {
    const pages = this.pages(query, sort);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as PageData) : null;
  }
}
