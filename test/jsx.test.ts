import { createElement, use } from "react";
import { describe, expect, test } from "vitest";

import { AbortError } from "../src/index.js";
import { renderElementToHTML } from "../src/jsx.js";

const SuspendForever = () => {
  use(new Promise<never>(() => {}));
  return null;
};

describe("renderElementToHTML", () => {
  test("renders an element to an HTML string", async () => {
    await expect(renderElementToHTML(createElement("p", null, "hi"))).resolves.toBe("<p>hi</p>");
  });

  test("rejects when the signal is already aborted", async () => {
    const reason = new Error("stop");

    const rendering = renderElementToHTML(createElement(SuspendForever), {
      signal: AbortSignal.abort(reason),
    });

    await expect(rendering).rejects.toBe(reason);
  });

  test("rejects when the signal aborts while rendering", async () => {
    const controller = new AbortController();
    const reason = new AbortError("stop");

    const rendering = renderElementToHTML(createElement(SuspendForever), {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(reason), 10);

    await expect(rendering).rejects.toBe(reason);
  });
});
