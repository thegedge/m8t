import { expect, test, vi } from "vitest";

import { NullBlobCache } from "../../../src/utils/cache/NullBlobCache.js";

test("NullBlobCache stores nothing", async () => {
  const cache = new NullBlobCache<string>();
  const produce = vi.fn(async (input: string) => `data for ${input}`);

  expect(await cache.get("key", produce)).toEqual(new TextEncoder().encode("data for key"));
  expect(await cache.get("key", produce)).toEqual(new TextEncoder().encode("data for key"));
  expect(produce).toHaveBeenCalledTimes(2);
  expect(produce).toHaveBeenCalledWith("key");
  await expect(cache.delete("key")).resolves.toBeUndefined();
});

test("NullBlobCache returns undefined when produce does", async () => {
  const cache = new NullBlobCache<string>();

  expect(await cache.get("key", async () => undefined)).toBeUndefined();
});

test("NullBlobCache propagates errors from produce", async () => {
  const cache = new NullBlobCache<string>();

  await expect(
    cache.get("key", async () => {
      throw new Error("produce failed");
    }),
  ).rejects.toThrow("produce failed");
});
