export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null)
  );
};
