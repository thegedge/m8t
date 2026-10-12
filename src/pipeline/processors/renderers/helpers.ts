import { unthunk } from "../../../utils/unthunk.js";
import type { Datum } from "../../Datum.js";

export type ContentFunctionOptions = {
  signal: AbortSignal;
};

export type ContentFunction<T = unknown> = (options: ContentFunctionOptions) => T | Promise<T>;
export type UnthunkedContentFunction<T = string> = (
  content: unknown,
  options: ContentFunctionOptions,
) => T | Promise<T>;

export const symRenderer = Symbol.for("renderer");
export const symRenderedBy = Symbol.for("renderedBy");

/**
 * Wrap a given content function to be provided an unthunked content value from a given datum.
 *
 * The result is shared between callers using the same abort signal (or between callers that
 * provide no signal). A render that rejects is never served to later callers.
 */
export const unthunked = <T = string>(
  datum: Datum,
  f: UnthunkedContentFunction<T>,
): ContentFunction<T> => {
  const originalContent = datum.get("content");
  const render = async (options: ContentFunctionOptions) => {
    let content = originalContent;
    if (typeof originalContent === "function") {
      content = await unthunk(content as ContentFunction, options);
    }

    return await f(content, options);
  };

  let cached: Promise<T> | null = null;
  return async (options?: ContentFunctionOptions) => {
    cached ??= render(options as ContentFunctionOptions).catch((e) => {
      cached = null; // don't cache rejections
      throw e;
    });
    return await cached;
  };
};
