import type { ProcessorConstructor } from "./processors/index.ts";
import { Search } from "./Search.ts";

export type { Search } from "./Search.ts";

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export type MaybeGenerator<T> = T | Generator<T>;

export type PageData<OtherData = Record<string, any>> = {
  /**
   * The (relative) path to write this page's contents to.
   *
   * Oftentimes this can be the same as the URL, but not always. For example, html pages will often
   * be written to an `index.html` file, but the URL will not include the `/index.html` part.
   */
  outputPath: string;

  /** The url used to access this page */
  url: string;

  /** The slug for this page, often used as part of the URL */
  slug: string;

  /** The title for this page */
  title: string;

  /** A subtitle for this page */
  subtitle?: string;

  /** The date this page was written/published */
  date: Date | null;

  /** The layout file to use for this page */
  layout?: string | null;

  /** The layout file to use for this page */
  processor?: ProcessorConstructor<any> | null;

  /** An optional description of this page's contents */
  description?: string;

  /** An optional list of tags that can identify this page in a search */
  tags?: string[];

  /** Keywords for this page that can be used to identify this page for search engines */
  keywords?: string[];
} & OtherData;

export type PageComponentProps<DataT extends Record<string, any> = Record<string, any>, ChildrenT = any> = {
  data: PageData<DataT>;
  search: Search;
  children?: ChildrenT;
};
