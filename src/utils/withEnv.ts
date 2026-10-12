/**
 * Set an environment variable.
 *
 * @return a disposable that returns the env var to its original value.
 */
export const withEnv = (key: string, value: string | undefined) => {
  const original = process.env[key];
  process.env[key] = value;
  return {
    [Symbol.dispose]() {
      process.env[key] = original;
    },
  };
};
