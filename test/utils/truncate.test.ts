import { describe, expect, test } from "vitest";

import { truncate } from "../../src/utils/truncate.js";

describe("truncate", () => {
  test("returns the same string when under the limit", () => {
    expect(truncate("abc")).toEqual("abc");
  });

  test("returns the same string when under the limit + ellipsis length", () => {
    expect(truncate("abc123", { length: 4 })).toEqual("abc123");
  });

  test("returns a truncated string when above the limit", () => {
    expect(truncate("abc123", { length: 2 })).toEqual("ab...");
  });

  test("returns a truncated string with a custom ellipsis", () => {
    expect(truncate("abc123", { length: 2, ellipsis: "!!!" })).toEqual("ab!!!");
  });

  test("does not split in the middle of a UTF-16 codepoint", () => {
    const woman = "\uD83D\uDC69";
    const boy = "\uD83D\uDC66";
    expect(truncate(woman + boy + woman + boy, { length: 1 })).toEqual(`${woman}...`);
  });
});
