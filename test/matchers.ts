import { isValidElement } from "react";
import { expect } from "vitest";

import type { Datum } from "../src/index.js";
import { renderElementToHTML } from "../src/jsx.js";
import type { FileMatcher } from "../src/utils/FileMatcher.js";
import { unthunk } from "../src/utils/unthunk.js";

expect.extend({
  async toRenderTo(received: unknown, expected: string) {
    const { isNot } = this;

    if (!isValidElement(received)) {
      return {
        pass: false,
        message: () => `${received} is${isNot ? "" : " not"} a React element`,
      };
    }

    const rendered = await renderElementToHTML(received);
    return {
      pass: rendered === expected,
      message: () => `${received} does${isNot ? "" : " not"} render to ${expected}`,
    };
  },

  async toHaveContent(datum: Datum, expected: string) {
    const { isNot } = this;

    if (!datum.has("content")) {
      return {
        pass: false,
        message: () => `datum ${isNot ? "has" : "does not have"} a content key`,
      };
    }

    const content = await unthunk(datum.get("content"), { signal: new AbortController().signal });
    if (typeof content !== "string") {
      return {
        pass: false,
        message: () => `datum ${isNot ? "has" : "does not have"} string content`,
      };
    }

    return {
      pass: content === expected,
      message: () =>
        `datum content ${JSON.stringify(content)} ${isNot ? "is" : "is not"} ${JSON.stringify(expected)}`,
    };
  },

  toMatchPath(fileMatcher: FileMatcher, path: string) {
    const { isNot } = this;
    return {
      pass: fileMatcher.matches(path),
      message: () => `${path} does${isNot ? "" : " not"} match`,
    };
  },

  toBeInRange<T extends number | bigint>(received: T, expected: T, range: T) {
    const { isNot } = this;
    return {
      pass:
        received < expected
          ? (received as any) + range >= expected
          : (received as any) - range <= expected,
      message: () => `${received} is${isNot ? "" : " not"} within ${range} of ${expected}`,
    };
  },
});
