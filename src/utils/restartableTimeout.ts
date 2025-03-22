/**
 * Sets up a timeout that rejects after a certain period of time, but can be completed or restarted.
 *
 * @returns An object containing:
 *   - `restart`: function that can be called to restart the timeout
 *   - `promise`: a promise that resolves when complete is called, or rejects when the timeout occurs
 */
export const restartableTimeout = (ms: number) => {
  const { reject, promise } = Promise.withResolvers<void>();

  let timeout: NodeJS.Timeout;
  const restart = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      reject(new Error("timed out"));
    }, ms);
  };

  restart();

  return { restart, promise };
};
