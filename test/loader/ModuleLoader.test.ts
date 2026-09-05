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
    loader = new ModuleLoader();
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  test("resolves the namespace for a simple module with no dependencies", async () => {
    await writeFixtures(root, { "simple.mjs": 'export const value = "hi";\n' });
    loader.use(async (filename) => await fs.promises.readFile(filename, "utf-8"));

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
    loader.use(async (filename) => await fs.promises.readFile(filename, "utf-8"));

    const namespace = await loader.load(path.join(root, "simple.mjs"));

    expect(namespace).toHaveProperty("value", os.userInfo());
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

    loader.use(async (filename) => {
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

    loader.use(async (filename) => {
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
});
