import { isValidElement } from "react";
import { expect } from "vitest";

import { renderElementToHTML } from "../src/jsx.js";
import type { FileMatcher } from "../src/utils/FileMatcher.js";

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
