/**
 * Truncate a string to a given length.
 *
 * If the string exceeds the given length, the string is truncated and an ellipsis is added.
 *
 * **Note** that the length calculation is done in UTF-16 code units, but some characters may
 * span multiple units. This means that the string may not _actually_ be longer than the given
 * limit but is truncated anyways. Code points aren't split though.
 *
 * @returns the truncated string, if it exceeds the given limit
 */
export const truncate = (
  value: string,
  options?: {
    /**
     * Length in UTF-16 code units
     *
     * @defaultValue 50
     */
    length?: number;

    /**
     * Custom ellipsis to use when truncating
     *
     * @defaultValue "..."
     */
    ellipsis?: string;
  },
) => {
  const { length = 50, ellipsis = "..." } = options ?? {};
  return value.length > length + ellipsis.length
    ? // slice/substring do not consider code points, so we use the iterable form, which does
      [...value].slice(0, length).join("") + ellipsis
    : value;
};
