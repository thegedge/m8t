import { describe, expect, test, vi } from "vitest";

import { unthunked } from "../../../../src/pipeline/processors/renderers/helpers.js";
import { testData } from "../../../helpers.js";

describe("unthunked", () => {
  test("shares a result between calls using the same signal", async () => {
    const f = vi.fn(async (content: unknown) => String(content));
    const content = unthunked(testData({ content: "a" }), f);
    const { signal } = new AbortController();

    await expect(content({ signal })).resolves.toBe("a");
    await expect(content({ signal })).resolves.toBe("a");
    expect(f).toHaveBeenCalledOnce();
  });

  test("shares results between distinct signals", async () => {
    const f = vi.fn(async (content: unknown) => String(content));
    const content = unthunked(testData({ content: "a" }), f);

    await content({ signal: new AbortController().signal });
    await content({ signal: new AbortController().signal });

    expect(f).toHaveBeenCalledOnce();
  });

  test("does not serve a rejected result to later callers", async () => {
    let attempts = 0;
    const content = unthunked(testData({ content: "a" }), async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("sad");
      }
      return "ok";
    });
    const { signal } = new AbortController();

    await expect(content({ signal })).rejects.toThrow("sad");
    await expect(content({ signal })).resolves.toBe("ok");
  });

  test("does not serve a rejected result when there is no signal", async () => {
    let attempts = 0;
    const content = unthunked(testData({ content: "a" }), async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("sad");
      }
      return "ok";
    });
    const withoutSignal = content as () => Promise<string>;

    await expect(withoutSignal()).rejects.toThrow("sad");
    await expect(withoutSignal()).resolves.toBe("ok");
  });
});
