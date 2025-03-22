/**
 * Returns a promise that resolves when the counter reaches 0.
 *
 * Note that although the counter starts at 0, immediately calling `decrement` will throw an error.
 * In other words, the caller must call `increment` at least once before `decrement` should be called.
 * The promise will resolve when the counter reaches 0 _after_ being incremented.
 *
 * @returns an object containing:
 *   - `increment`: function that can be called to increment the counter
 *   - `decrement`: function that can be called to decrement the counter
 *   - `promise`: a promise that resolves when the counter reaches 0
 */
export const counterPromise = () => {
  let count = 0;
  const { resolve, reject, promise } = Promise.withResolvers<void>();

  const increment = () => {
    count++;
  };

  const decrement = () => {
    count--;
    if (count < 0) {
      reject(new Error("counter as decremented below 0"));
    } else if (count === 0) {
      resolve();
    }
  };

  return { increment, decrement, promise };
};
