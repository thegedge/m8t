import type { ContentFunction, ContentFunctionOptions } from "./processors/renderers/helpers.js";

const symDerived = Symbol.for("derived");

/**
 * A datum value that is computed lazily at render time.
 *
 * Memoization is the responsibility of the wrapped function; build it with `unthunked` to share
 * one result per abort signal.
 */
export type Derived<T> = ContentFunction<T> & { readonly [symDerived]: true };

/** Marks a function as a {@link Derived} value. */
export const derived = <T>(resolve: ContentFunction<T>): Derived<T> =>
  Object.assign((options: ContentFunctionOptions) => resolve(options), {
    [symDerived]: true as const,
  });

/** Returns a copy of the given record with every {@link Derived} value replaced by its result. */
export const resolveDerived = async <T extends Record<string, unknown>>(
  record: T,
  options: ContentFunctionOptions,
): Promise<T> => {
  const entries = await Promise.all(
    Object.entries(record).map(async ([key, value]) => {
      const isDerived = typeof value === "function" && symDerived in value;
      return [key, isDerived ? await (value as Derived<unknown>)(options) : value] as const;
    }),
  );
  return { ...record, ...Object.fromEntries(entries) };
};
