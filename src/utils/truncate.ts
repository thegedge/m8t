/**
 * Truncate a string to a given length.
 *
 * If the string exceeds the given length, the string is truncated and a given ellipsis is added (defaults to "...")
 *
 * @returns the truncated string.
 */
export const truncate = (
  value: string,
  options: { length?: number; ellipsis?: string } = { length: 50, ellipsis: "..." },
) => {
  const { length = 50, ellipsis = "..." } = options;
  return value.length > length ? value.slice(0, length) + ellipsis : value;
};
