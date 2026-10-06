import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { ModuleLoader } from "../../src/loader/ModuleLoader.js";
import { dedent } from "../../src/utils/dedent.js";
import { fixturesRoot, writeFixtures } from "../helpers.js";

describe("ModuleLoader", () => {
  let root: string;
  let loader: ModuleLoader;

  beforeEach(async () => {
    root = await fixturesRoot("m8t-loader-test-");
    loader = ModuleLoader.with(async (filename) => await fs.promises.readFile(filename, "utf-8"));
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  test("resolves the namespace for a simple module with no dependencies", async () => {
    await writeFixtures(root, { "simple.mjs": 'export const value = "hi";\n' });

    const namespace = await loader.load(path.join(root, "simple.mjs"));

    expect(namespace).toHaveProperty("value", "hi");
  });

  test("resolves the namespace for a builtin module", async () => {
    await writeFixtures(root, {
      "simple.mjs": dedent`
        import os from "node:os";

        export const value = os.userInfo();
      `,
    });

    const namespace = await loader.load(path.join(root, "simple.mjs"));

    expect(namespace).toHaveProperty("value", os.userInfo());
  });

  test("does not have an unhandled error when loading a module with a non-existent import", async () => {
    await writeFixtures(root, {
      "broken.mjs": dedent`
        import { what } from "not_a_thing";

        console.log("oops");
      `,
    });

    const brokenPath = path.join(root, "broken.mjs");

    const loading = loader.load(brokenPath);
    await expect(loading).rejects.toThrow(/unable to resolve/);
    await expect(loading).rejects.toMatchObject({
      name: "LoadError",
      specifier: "not_a_thing",
      cause: expect.any(Error),
    });
  });

  test("loads two modules that import each other without deadlocking or throwing", async () => {
    await writeFixtures(root, {
      "cycleA.mjs": dedent`
        import { b } from "./cycleB.mjs";

        export const a = "A";
        export const getB = () => b;
      `,
      "cycleB.mjs": dedent`
        import { a } from "./cycleA.mjs";

        export const b = "B";
        export const getA = () => a;
      `,
    });

    const cycleA = path.join(root, "cycleA.mjs");
    const cycleB = path.join(root, "cycleB.mjs");

    const loader = ModuleLoader.with(async (filename) => {
      if (filename === cycleA || filename === cycleB) {
        return await fs.promises.readFile(filename, "utf-8");
      }
      return undefined;
    });

    const [namespaceA, namespaceB] = await Promise.all([loader.load(cycleA), loader.load(cycleB)]);

    expect(namespaceA).toHaveProperty("a", "A");
    expect(namespaceB).toHaveProperty("b", "B");
    expect((namespaceA.getB as () => string)()).toBe("B");
    expect((namespaceB.getA as () => string)()).toBe("A");
  });

  test("loads two entry modules that concurrently share a dependency", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import { value } from "./shared.mjs";
        export const a = value + "-A";
      `,
      "entryB.mjs": dedent`
        import { value } from "./shared.mjs";
        export const b = value + "-B";
      `,
      "shared.mjs": dedent`
        import esbuild from "esbuild";
        export const value = esbuild ? "has-esbuild" : "no-esbuild";
      `,
      "node_modules/esbuild/package.json": JSON.stringify({
        name: "esbuild",
        main: "lib/main.js",
        engines: {
          node: ">=18",
        },
      }),
      "node_modules/esbuild/lib/main.js": dedent`
        export default true;
      `,
    });

    const entryA = path.join(root, "entryA.mjs");
    const entryB = path.join(root, "entryB.mjs");
    const shared = path.join(root, "shared.mjs");

    const libGate = Promise.withResolvers<void>();
    const libRequested = Promise.withResolvers<void>();

    const loader = ModuleLoader.with(async (filename) => {
      if (filename === entryA || filename === entryB || filename === shared) {
        return await fs.promises.readFile(filename, "utf-8");
      }

      if (filename.includes(`${path.sep}node_modules${path.sep}esbuild${path.sep}`)) {
        libRequested.resolve();
        await libGate.promise;
      }

      return undefined;
    });

    const loadA = loader.load(entryA).catch((e) => ({ a: `failed to load ${e}` }));
    const loadB = loader.load(entryB).catch((e) => ({ b: `failed to load ${e}` }));

    await libRequested.promise;
    await setImmediate(); // flush microtask queue
    libGate.resolve();

    const [namespaceA, namespaceB] = await Promise.all([loadA, loadB]);

    expect(namespaceA).toHaveProperty("a", "has-esbuild-A");
    expect(namespaceB).toHaveProperty("b", "has-esbuild-B");
  });

  test("loads a dependency concurrently while it is being linked as part of its dependent", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import { b } from "./depB.mjs";
        export const a = b + "-A";
      `,
      "depB.mjs": dedent`
        import { c } from "./depC.mjs";
        export const b = c + "-B";
      `,
      "depC.mjs": dedent`
        export const c = "C";
      `,
    });

    const depC = path.join(root, "depC.mjs");

    const cGate = Promise.withResolvers<void>();
    const cRequested = Promise.withResolvers<void>();

    const loader = ModuleLoader.with(async (filename) => {
      if (filename === depC) {
        cRequested.resolve();
        await cGate.promise;
      }
      return await fs.promises.readFile(filename, "utf-8");
    });

    const loadA = loader.load(path.join(root, "entryA.mjs"));

    // depB is now "linking" as part of entryA's link, waiting on depC
    await cRequested.promise;
    const loadB = loader.load(path.join(root, "depB.mjs"));
    await setImmediate(); // flush microtask queue
    cGate.resolve();

    const [namespaceA, namespaceB] = await Promise.all([loadA, loadB]);

    expect(namespaceA).toHaveProperty("a", "C-B-A");
    expect(namespaceB).toHaveProperty("b", "C-B");
  });

  test("returns a namespace whose bindings are initialized when a module with top-level await is loaded concurrently as a static dependency", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import "./top-level-await.mjs";
        export const value = "A";
      `,
      "top-level-await.mjs": dedent`
        await new Promise((resolve) => setTimeout(resolve, 300));
        export const s = "ready";
      `,
    });

    const entryA = path.join(root, "entryA.mjs");
    const topLevelAwait = path.join(root, "top-level-await.mjs");

    const loadA = loader.load(entryA);
    const namespaceTopLevelAwait = await loader.load(topLevelAwait);

    // An invalid implementation of module evaluation may not properly wait for the top-level
    // await to settle first, and we access this before it's initialized.
    expect(namespaceTopLevelAwait.s).toBe("ready");

    // Let entryA's load settle too so it doesn't leak into other tests.
    await loadA;
  });

  test("returns a namespace whose bindings are initialized when a module with top-level await is dynamically imported while loading concurrently as a static dependency", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import "./tla.mjs";
        export const value = "A";
      `,
      "entryB.mjs": dedent`
        const { s } = await import("./tla.mjs");
        export const value = s;
      `,
      "tla.mjs": dedent`
        await new Promise((resolve) => setTimeout(resolve, 50));
        export const s = "ready";
      `,
    });

    const loadA = loader.load(path.join(root, "entryA.mjs"));
    const namespaceB = await loader.load(path.join(root, "entryB.mjs"));

    expect(namespaceB).toHaveProperty("value", "ready");

    await loadA;
  });

  test("resolves a dynamic import, from a module with top-level await, of an already evaluated sibling dependency", async () => {
    await writeFixtures(root, {
      "entry.mjs": dedent`
        import "./sibling.mjs";
        import { value } from "./tla.mjs";
        export { value };
      `,
      "sibling.mjs": dedent`
        export const value = "sibling";
      `,
      "tla.mjs": dedent`
        const { value: siblingValue } = await import("./sibling.mjs");
        export const value = siblingValue;
      `,
    });

    const namespace = await loader.load(path.join(root, "entry.mjs"));

    expect(namespace).toHaveProperty("value", "sibling");
  });

  test("rejects a concurrent load of a static dependency whose top-level await rejects", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import "./tla.mjs";
        export const value = "A";
      `,
      "tla.mjs": dedent`
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error("tla failed");
      `,
    });

    const loadA = loader.load(path.join(root, "entryA.mjs"));
    const loadTla = loader.load(path.join(root, "tla.mjs"));

    await expect(loadTla).rejects.toThrow("tla failed");
    await expect(loadA).rejects.toThrow("tla failed");
  });

  test("resolves a concurrent load of a static dependency when a sibling dependency's top-level await rejects", async () => {
    await writeFixtures(root, {
      "entryA.mjs": dedent`
        import "./ok.mjs";
        import "./tla.mjs";
        export const value = "A";
      `,
      "ok.mjs": dedent`
        export const value = "ok";
      `,
      "tla.mjs": dedent`
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error("tla failed");
      `,
    });

    const loadA = loader.load(path.join(root, "entryA.mjs"));
    const loadOk = loader.load(path.join(root, "ok.mjs"));

    await expect(loadOk).resolves.toHaveProperty("value", "ok");
    await expect(loadA).rejects.toThrow("tla failed");
  });

  test("properly captures errors thrown from a transpiler", async () => {
    const loader = ModuleLoader.with(async (_filename) => {
      throw new Error("this is my error");
    });

    await expect(() => loader.load("test.js")).rejects.toThrow("this is my error");
  });
});
