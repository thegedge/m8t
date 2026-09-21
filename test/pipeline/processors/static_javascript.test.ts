import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Datum, StaticJavascriptProcessor } from "../../../src/index.js";
import { dedent } from "../../../src/utils/dedent.js";
import { makeContext, writeFixtures, type TestContext } from "../../helpers.js";

describe("StaticJavascriptProcessor", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("can bundle static javascript, typescript, and tsx", async () => {
    const fixtures = {
      "./test.tsx": dedent`
        export const MyComponent = (props: { test: string }) => {
          return <div>{props.test}</div>
        }
      `,
      "./stuff.ts": dedent`
        import { sum } from "./lib/sum";

        console.log(sum(1, 2));
      `,
      "./lib/sum.js": dedent`
        export const sum = (a, b) => a + b;
      `,
    };
    await writeFixtures(context.root, fixtures);

    const result = await process(context.datum("test.tsx"), context.datum("stuff.ts"));

    expect(result).toHaveLength(2);
    expect(result[0].toRecord()).toMatchObject({
      url: "/javascript/stuff.js",
      outputPath: "javascript/stuff.js",
      mimeType: "text/javascript",
      filename: expect.stringContaining(context.site.out.rootPath),
      content: expect.stringMatching(
        new RegExp(
          [
            "^// lib/sum.js$",
            "^var sum = (a, b) => a \\+ b;$",
            "^// stuff.ts$",
            "^console.log(sum(1, 2));$",
            "^//# sourceMappingURL=",
          ]
            .join(".+")
            .replaceAll(/([/()])/g, "\\$1"),
          "ms",
        ),
      ),
    });
    expect(result[1].toRecord()).toMatchObject({
      url: "/javascript/test.js",
      outputPath: "javascript/test.js",
      mimeType: "text/javascript",
      filename: expect.stringContaining(context.site.out.rootPath),
      content: expect.stringMatching(
        new RegExp(
          [
            "^// test.tsx$",
            `React.createElement("div", null, props.test)`,
            "^//# sourceMappingURL=",
          ]
            .join(".+")
            .replaceAll(/([/()])/g, "\\$1"),
          "ms",
        ),
      ),
    });
  });

  test("lets non-JS datums pass through", async () => {
    const result = await process(context.datum("test.txt", { blah: "some text" }));

    expect(result).toHaveLength(1);
    expect(result[0].toRecord()).toMatchObject({
      filename: expect.stringMatching(/\/test.txt$/),
      blah: "some text",
    });
  });

  const process = async (...data: Datum[]) => {
    const processor = new StaticJavascriptProcessor("/javascript");
    const results = await processor.processMany(data, context);

    if (!Array.isArray(results)) {
      throw new Error("expected an array of results");
    }

    return results.toSorted((a, b) =>
      String(a.get("filename")).localeCompare(String(b.get("filename"))),
    );
  };
});
