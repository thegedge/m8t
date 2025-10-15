/**
 * Wrap a given function such that it remembers the result for a given set of arguments.
 *
 * @param fn - the function to wrap
 *
 * @returns the memoized version of the given function
 */
export const memoize = <ArgsT extends any[], ResultT>(fn: (...args: ArgsT) => ResultT) => {
  if (fn.length == 0) {
    let computed = false;
    let result: ResultT;
    return () => {
      if (computed) {
        return result;
      }

      result = (fn as unknown as () => ResultT)();
      computed = true;
      return result;
    };
  }

  const cache = new Map<string, ResultT>();
  return (...args: ArgsT) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
