import { Search } from "./Search.ts";

export type { Search } from "./Search.ts";

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export type MaybeGenerator<T> = T | Generator<T>;

export type PageData = Record<string, unknown>;

export type PageComponentProps<ChildrenT = unknown> = {
  data: PageData;
  search: Search;
  children?: ChildrenT;
};

export type ContentFunction<ChildrenT = unknown> = (props: PageComponentProps<ChildrenT>) => Promise<unknown> | unknown;
