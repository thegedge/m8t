import type { DatumShape } from "./pipeline/Datum.js";
import type { Query } from "./Search.js";

export type * from "./pipeline/index.js";
export type { SiteOptions } from "./Site.js";

export interface Search {
  pages(query: Query): Promise<DatumShape[]>;
  previousPage(url: string, query: Query): Promise<DatumShape | null>;
  nextPage(url: string, query: Query): Promise<DatumShape | null>;
}

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export type MaybeGenerator<T> = T | Generator<T>;

export type ContentFunction = (props: DatumShape) => Promise<unknown> | unknown;
