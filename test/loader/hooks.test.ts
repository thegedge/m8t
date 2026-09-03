import type { LoadFnOutput, LoadHookContext } from "node:module";
import { describe, expect, test, vi } from "vitest";

import { load } from "../../src/loader/hooks.js";

const context: LoadHookContext = {
  conditions: ["node", "import"],
  format: undefined,
  importAttributes: {},
};

const nextLoadStub = (source: string) => {
  const calls: { url: string; context: Partial<LoadHookContext> | undefined }[] = [];
  const nextLoad = (url: string, nextContext?: Partial<LoadHookContext>): LoadFnOutput => {
    calls.push({ url, context: nextContext });
    return {
      format: nextContext?.format ?? "module",
      source,
    };
  };

  return { calls, nextLoad };
};

describe("load", () => {
  test("compiles TSX to JS", () => {
    const { nextLoad } = nextLoadStub(`
      export const Component = (props: { name: string }) => <div>{props.name}</div>;
    `);

    const result = load("file://site/add.tsx", context, nextLoad);

    const source = String(result.source);
    expect(result.format).toBe("module");
    expect(result.shortCircuit).toBe(true);
    expect(source).toContain("react/jsx-dev-runtime");
    expect(source).not.toContain("<div>");
    expect(source).not.toContain(": string");
  });

  test("compiles JSX to JS", () => {
    const { nextLoad } = nextLoadStub(`
      export const Component = (props) => <div>{props.name}</div>;
    `);

    const result = load("file:///site/add.jsx", context, nextLoad);

    const source = String(result.source);
    expect(result.format).toBe("module");
    expect(result.shortCircuit).toBe(true);
    expect(source).toContain("react/jsx-dev-runtime");
    expect(source).not.toContain("<div>");
    expect(source).not.toContain(": string");
  });

  if (process.features.typescript) {
    test("passes TS through to nextLoad unchanged when process.features.typescript set", () => {
      const { calls, nextLoad } = nextLoadStub("let f: () => string");
      const url = `file:///site/file.ts`;

      const result = load(url, context, nextLoad);

      expect(calls).toEqual([{ url, context }]);
      expect(result.source).toBe("let f: () => string");
      expect(result.shortCircuit).toBeUndefined();
    });
  }

  test("compiles TS to JS when process.features.typescript false", () => {
    vi.spyOn(process.features, "typescript", "get").mockReturnValue(false);
    const { nextLoad } = nextLoadStub(`const sum = (a: number, b: number) => a + b`);
    const url = `file:///site/file.ts`;

    const result = load(url, context, nextLoad);
    const source = String(result.source);

    expect(result.format).toBe("module");
    expect(result.shortCircuit).toBe(true);
    expect(source.startsWith("const sum = (a, b) => a + b;\n//# sourceMappingURL")).toBeTruthy();
  });

  test.each([
    {
      file: "script.js",
      content: "const a = 1;",
    },
    {
      file: "styles.css",
      content: ".a { color: red; }",
    },
  ])("passes %s through to nextLoad unchanged", ({ file, content }) => {
    const { calls, nextLoad } = nextLoadStub(content);
    const url = `file:///site/${file}`;

    const result = load(url, context, nextLoad);

    expect(calls).toEqual([{ url, context }]);
    expect(result.source).toBe(content);
    expect(result.shortCircuit).toBeUndefined();
  });
});
