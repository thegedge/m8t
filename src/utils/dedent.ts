// The key bit to this regex, and some below, is [^\S\n]. We want to match whitespace, but NOT a newline.
// We could list out all the whitespace characters, but this is a bit more concise.
//
// Basically, we're asking for zero or more characters that are not non-whitespace and not a newline.
// If you simplify that double negation you get "whitespace and not a newline".
const LEADING_WHITESPACE_ONLY_LINE_REGEX = /^[^\S\n]*\n/;
const TRAILING_WHITESPACE_ONLY_LINE_REGEX = /\n[^\S\n]*$/;

/**
 * A template literal that strips leading and trailing newlines, then common leading whitespace.
 *
 * @example
 * ```ts
 * const a = dedent`
 *     Hello, world!
 *       This is line has more indent.
 *     This line has the same as the first line.
 * `;
 * // "Hello, world!\n  This is line has more indent.\nThis line has the same as the first line."
 */
export const dedent = (strings: TemplateStringsArray, ...values: unknown[]) => {
  // I often use dedent in a way where the backticks line up vertically, so there will be newlines,
  // and typically some whitespace on the final line. They're not desired in the final output, so
  // we trim them before doing our computation.
  const trimmedLeadingTrailingNewlines = strings.map((s, index) => {
    if (strings.length === 1) {
      return s
        .replace(LEADING_WHITESPACE_ONLY_LINE_REGEX, "")
        .replace(TRAILING_WHITESPACE_ONLY_LINE_REGEX, "");
    } else if (index === 0) {
      return s.replace(LEADING_WHITESPACE_ONLY_LINE_REGEX, "");
    } else if (index === strings.length - 1) {
      // This is the wrong check. For example:
      //
      // dedent`
      //   Hello, world!
      //     ${value}
      //     This is ${value} a test`
      //
      // In this case the penultimate string is the one to trim.
      //
      return s.replace(TRAILING_WHITESPACE_ONLY_LINE_REGEX, "");
    }
    return s;
  });

  // Our computation for smallest indent ignores the interpolated values, because how it looks in the
  // template string is what matters, not what's in the contents of interpolated values.
  // We interpolate the values later, after the computation.
  const stringifiedNoValues = trimmedLeadingTrailingNewlines.join(",");

  // Another fun regex: we want to find non-empty lines. Two cases here:
  //   - Whitespace, followed by a non-whitespace character
  //   - One or more whitespace characters
  //
  // We have to use a positive-lookahead so that the match length counts the whitespace
  const leastLeadingWhitespace = stringifiedNoValues
    .matchAll(/^([^\S\n]*(?=\S)|[^\S\n]+)/gm)
    .reduce((acc, match) => {
      return Math.min(acc, match[0].length);
    }, Number.POSITIVE_INFINITY);

  // Now that we've computed the least leading whitespace, we can combine all of the strings and values
  let regex: RegExp | null = null;
  if (Number.isFinite(leastLeadingWhitespace)) {
    regex = new RegExp(`^[^\\S\\n]{${leastLeadingWhitespace}}`, "gm");
  }

  return trimmedLeadingTrailingNewlines.reduce((result, string, i) => {
    result += regex ? string.replaceAll(regex, "") : string;
    if (i < values.length) {
      // TODO what if we could figure out how much indentation in front of this string and automatically
      //   add that indentation to any newlines contained within the string?
      result += String(values[i]);
    }

    return result;
  }, "");
};
