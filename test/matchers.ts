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
      message: () => `${rendered} is${isNot ? "" : " not"} ${expected}`,
    };
  },

  toMatchPath(fileMatcher: FileMatcher, path: string) {
    const { isNot } = this;
    return {
      pass: fileMatcher.matches(path),
      message: () => `${path} should${isNot ? " not" : ""} match`,
    };
  },
});
