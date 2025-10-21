export type * from "./pipeline/index.js";
export type { SiteOptions } from "./Site.js";

/**
 * A type that represents a value that may be an array.
 */
export type MaybeArray<T> = T | T[];

/**
 * A type that represents a value that may be a promise.
 */
export type MaybePromise<T> = T | Promise<T>;
