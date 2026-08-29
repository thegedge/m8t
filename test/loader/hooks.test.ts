import type { LoadFnOutput, LoadHookContext } from "node:module";
import { describe, expect, test } from "vitest";

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
  test("compiles TSX to javascript", () => {
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

  test("compiles JSX to javascript", () => {
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

  test("compiles .jsx sources to javascript", () => {
    const { nextLoad } = nextLoadStub(`
      export const Component = () => <span>hi</span>;
    `);

    const result = load("file:///site/component.jsx", context, nextLoad);

    const source = String(result.source);
    expect(result.shortCircuit).toBe(true);
    expect(source).toContain("react/jsx-dev-runtime");
    expect(source).not.toContain("<span>");
  });

  test.each(["file:///site/add.ts", "file:///site/add.mts"])("strips types from %s", (url) => {
    const { nextLoad } = nextLoadStub(`
      export const add = (a: number, b: number): number => a + b;
    `);

    const result = load(url, context, nextLoad);

    const source = String(result.source);
    expect(result.shortCircuit).toBe(true);
    expect(source).toContain("(a, b) => a + b");
    expect(source).not.toContain(": number");
  });

  test("forces the module format when reading transformable sources", () => {
    const { calls, nextLoad } = nextLoadStub(`export const x: number = 1;`);

    load("file:///site/x.ts", context, nextLoad);

    expect(calls).toHaveLength(1);
    expect(calls[0].context).toEqual({ ...context, format: "module" });
  });

  test.each(["file:///site/script.js", "file:///site/styles.css"])(
    "passes %s through to nextLoad unchanged",
    (url) => {
      const { calls, nextLoad } = nextLoadStub(`.a { color: red; }`);

      const result = load(url, context, nextLoad);

      expect(calls).toEqual([{ url, context }]);
      expect(result.source).toBe(`.a { color: red; }`);
      expect(result.shortCircuit).toBeUndefined();
    },
  );
});
