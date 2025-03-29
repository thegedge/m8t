import type { PageData } from "./PageData.ts";
import type { Pages } from "./Pages.ts";
import type { Search as SearchInterface } from "./types.ts";

export type Query = {
  where: Record<string, unknown>;
  sort?: readonly [string, "asc" | "desc"];
  priority?: number;
};

type ActiveQuery = {
  query: Query;
  resolve: (pages: PageData[]) => void;
};

export class Search implements SearchInterface {
  readonly #pages: Pages;

  constructor(pages: Pages) {
    this.#pages = pages;
  }

  async pages(query: Query): Promise<PageData[]> {
    await this.#pages.idle;

    const filtered = Array.from(this.#pages.pages.values()).filter((page) => {
      for (const [key, value] of Object.entries(query.where)) {
        if (page[key] != value) {
          return false;
        }
      }
      return true;
    });

    if (query.sort) {
      // TODO support multiple sort keys
      const [key, direction] = query.sort;
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

  async previousPage(url: string, query: Query): Promise<PageData | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }
    return index > 0 ? (pages[index - 1] as PageData) : null;
  }

  async nextPage(url: string, query: Query): Promise<PageData | null> {
    const pages = await this.pages(query);
    const index = pages.findIndex((p) => p.url == url);
    if (index == -1) {
      return null;
    }

    return index < pages.length - 1 ? (pages[index + 1] as PageData) : null;
  }
}
