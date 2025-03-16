import type { PageData } from "./PageData.ts";
import { Search } from "./Search.ts";

export type { Search } from "./Search.ts";

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export type MaybeGenerator<T> = T | Generator<T>;

export type PageComponentProps = {
  data: PageData;
  search: Search;
};

export type ContentFunction = (props: PageComponentProps) => Promise<unknown> | unknown;
