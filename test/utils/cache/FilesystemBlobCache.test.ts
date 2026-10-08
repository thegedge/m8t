import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { cacheKey } from "../../../src/utils/cache/cacheKey.js";
import { FilesystemBlobCache } from "../../../src/utils/cache/FilesystemBlobCache.js";
import { fixturesRoot } from "../../helpers.js";

const encode = (s: string) => new TextEncoder().encode(s);
const unreachable = async (): Promise<string> => {
  throw new Error("produce should not be called");
};

describe("FilesystemBlobCache", () => {
  let root: string;
  let dir: string;
  let cache: FilesystemBlobCache<string>;
  const input = "some input";
  const key = cacheKey(input);

  beforeEach(async () => {
    root = await fixturesRoot("m8t-blob-cache-test-");
    dir = path.join(root, "cache");
    cache = new FilesystemBlobCache({ dir, namespace: "ns", key: (input) => cacheKey(input) });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe("get", () => {
    test("returns a produced string as UTF-8 bytes on a miss", async () => {
      expect(await cache.get(input, async () => "héllo")).toEqual(encode("héllo"));
    });

    test("round-trips a string as UTF-8 bytes", async () => {
      await cache.get(input, async () => "héllo");

      expect(await cache.get(input, unreachable)).toEqual(encode("héllo"));
    });

    test("round-trips binary data", async () => {
      const data = new Uint8Array([0, 1, 2, 255, 0, 128]);
      await cache.get(input, async () => data);

      expect(await cache.get(input, unreachable)).toEqual(data);
    });

    test("round-trips empty data", async () => {
      await cache.get(input, async () => "");

      expect(await cache.get(input, unreachable)).toEqual(new Uint8Array());
    });

    test("passes the input to produce", async () => {
      const produce = vi.fn(async (input: string) => input.toUpperCase());

      expect(await cache.get(input, produce)).toEqual(encode("SOME INPUT"));
      expect(produce).toHaveBeenCalledWith(input);
    });

    test("doesn't call produce on a hit", async () => {
      await cache.get(input, async () => "data");
      const produce = vi.fn(async () => "other");

      expect(await cache.get(input, produce)).toEqual(encode("data"));
      expect(produce).not.toHaveBeenCalled();
    });

    test("hits for inputs with the same key and misses for different ones", async () => {
      const keyed = new FilesystemBlobCache<{ name: string; extra: number }>({
        dir,
        namespace: "ns",
        key: ({ name }) => cacheKey(name),
      });
      await keyed.get({ name: "a", extra: 1 }, async () => "a");

      expect(await keyed.get({ name: "a", extra: 2 }, unreachable)).toEqual(encode("a"));
      expect(await keyed.get({ name: "b", extra: 1 }, async () => "b")).toEqual(encode("b"));
    });

    test("stores nothing when produce returns undefined", async () => {
      expect(await cache.get(input, async () => undefined)).toBeUndefined();

      await expect(fs.readdir(dir)).rejects.toThrow("ENOENT");
      expect(await cache.get(input, async () => "data")).toEqual(encode("data"));
    });

    test("propagates errors from produce without caching anything", async () => {
      await expect(
        cache.get(input, async () => {
          throw new Error("produce failed");
        }),
      ).rejects.toThrow("produce failed");

      expect(await cache.get(input, async () => "data")).toEqual(encode("data"));
      expect(await fs.readdir(dir)).toEqual(["ns"]);
    });

    test("stores entries under dir/namespace/key", async () => {
      await cache.get(input, async () => "data");

      expect(await fs.readdir(path.join(dir, "ns"))).toEqual([key]);
    });

    test.each([
      ["an empty", () => new Uint8Array()],
      ["a truncated", (entry: Uint8Array) => entry.slice(0, entry.byteLength - 1)],
      ["a different", (entry: Uint8Array) => new Uint8Array(entry.byteLength).fill(7)],
    ])("re-produces and overwrites %s entry", async (_name, corrupt) => {
      await cache.get(input, async () => "some data");
      const filename = path.join(dir, "ns", key);
      await fs.writeFile(filename, corrupt(await fs.readFile(filename)));

      expect(await cache.get(input, async () => "fresh")).toEqual(encode("fresh"));
      expect(await cache.get(input, unreachable)).toEqual(encode("fresh"));
    });

    test("isolates namespaces", async () => {
      const other = new FilesystemBlobCache({
        dir,
        namespace: "other",
        key: (input: string) => cacheKey(input),
      });

      await cache.get(input, async () => "mine");

      expect(await other.get(input, async () => "theirs")).toEqual(encode("theirs"));
    });

    test("recreates the directory when it is removed after a write", async () => {
      await cache.get(input, async () => "first");
      await fs.rm(dir, { recursive: true });
      await cache.get(input, async () => "second");

      expect(await cache.get(input, unreachable)).toEqual(encode("second"));
    });

    test("returns the produced value when the cache can't be written", async () => {
      await fs.writeFile(path.join(root, "file"), "");
      const broken = new FilesystemBlobCache({
        dir: path.join(root, "file"), // a directory under a regular file can never be created
        namespace: "ns",
        key: (input: string) => cacheKey(input),
      });

      expect(await broken.get(input, async () => "data")).toEqual(encode("data"));
      expect(await broken.get(input, async () => "again")).toEqual(encode("again"));
      expect(await broken.delete(input)).toBeUndefined();
    });

    test("ignores keys that would escape the namespace", async () => {
      const escaping = new FilesystemBlobCache({
        dir,
        namespace: "ns",
        key: () => "../escaped",
      });

      expect(await escaping.get(input, async () => "data")).toEqual(encode("data"));
      expect(await escaping.get(input, async () => "again")).toEqual(encode("again"));
      expect(await escaping.delete(input)).toBeUndefined();
      await expect(fs.readdir(dir)).rejects.toThrow("ENOENT");
    });
  });

  describe("delete", () => {
    test("deletes an entry", async () => {
      await cache.get(input, async () => "data");
      await cache.get("other", async () => "other");
      await cache.delete(input);

      expect(await cache.get(input, async () => "again")).toEqual(encode("again"));
      expect(await cache.get("other", unreachable)).toEqual(encode("other"));
    });

    test("ignores deleting a missing entry", async () => {
      expect(await cache.delete(input)).toBeUndefined();
    });
  });
});
