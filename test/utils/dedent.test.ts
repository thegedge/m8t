import { describe, expect, test } from "vitest";

import { dedent } from "../../src/utils/dedent.js";

describe("dedent", () => {
  test("strips first whitespace-only line", () => {
    const result = dedent`    \n  Hello, world!`;
    expect(result).toBe("Hello, world!");
  });

  test("strips last whitespace-only line", () => {
    const result = dedent`Hello, world!  \n      `;
    expect(result).toBe("Hello, world!  ");
  });

  test("strips both leading and trailing whitespace-only lines", () => {
    const result = dedent`   \n\nHello, world!\n\nThis is a test \n  \n     `;
    expect(result).toBe("\nHello, world!\n\nThis is a test \n  ");
  });

  test("should not adjust leading whitespace if one line has no indent", () => {
    const result = dedent`
Hello, world!
    This is a test
        `;
    expect(result).toBe("Hello, world!\n    This is a test");
  });

  test("should remove common leading whitespace", () => {
    const result = dedent`
        Hello, world!
          This is a test
         Another line
      `;
    expect(result).toBe("Hello, world!\n  This is a test\n Another line");
  });

  test("should ignore empty lines when figuring out the common leading whitespace", () => {
    const result = dedent`

          Hello, world!


              Another line

        `;
    expect(result).toBe("\nHello, world!\n\n\n    Another line\n");
  });

  test("should correctly handle interpolated values when computing indents", () => {
    const value = "line1 line2 line3";
    const result = dedent`
        Hello, world!
      ${value}
        test
      `;
    expect(result).toBe(`  Hello, world!\n${value}\n  test`);
  });

  test("should ignore newlines in interpolated values when computing indents", () => {
    const value = "\n\nline1 line2 line3\t\t\n";
    const result = dedent`
        Hello, world!
      ${value}
        test
      `;
    expect(result).toBe(`  Hello, world!\n${value}\n  test`);
  });
});
