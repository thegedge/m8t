import { isValidElement } from "react";
import { expect } from "vitest";

import { renderElementToHTML } from "../src/jsx.js";

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
      message: () => `${received} is${isNot ? " not" : ""} ${expected}`,
    };
  },
});
