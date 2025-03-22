import type { PageData } from "./PageData.ts";
import type { Query } from "./Search.ts";

export interface Search {
  pages(query: Query): Promise<PageData[]>;
  previousPage(url: string, query: Query): Promise<PageData | null>;
  nextPage(url: string, query: Query): Promise<PageData | null>;
}

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export type MaybeGenerator<T> = T | Generator<T>;

export type ContentFunction = (props: PageData) => Promise<unknown> | unknown;
