import { inspect } from "node:util";

/**
 * Wrap a given function such that it remembers the result for a given set of arguments.
 *
 * Note that the method for deciding a memoization key is based on Node's {@link inspect}
 * method, with most limitations removed so as to avoid collisions.
 *
 * @param fn - the function to wrap
 *
 * @returns the memoized version of the given function
 */
export const memoize = <ArgsT extends any[], ResultT>(fn: (...args: ArgsT) => ResultT) => {
  const cache = new Map<string, ResultT>();
  return (...args: ArgsT) => {
    const key = inspect(args, {
      breakLength: Infinity,
      colors: false,
      depth: Infinity,
      maxArrayLength: null,
      maxStringLength: null,
    });
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
