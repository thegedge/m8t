/** A function that returns a T, or T itself **/
export type Thunk<T, ArgsT extends unknown[] = []> = T | ((...args: ArgsT) => T);

/**
 * Unthunk a given value.
 *
 * If the given value is not a function, return the value itself.
 * If the given value is a function, call it with the given args.
 */
export const unthunk = <T, ArgsT extends unknown[]>(value: Thunk<T, ArgsT>, args?: ArgsT): T => {
  if (typeof value == "function") {
    return (value as Function)(...(args ?? []));
  }
  return value;
};
