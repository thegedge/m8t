import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

import { Datum, TypescriptLoader } from "../../../../src/index.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { linkNodeModules, makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("TypescriptLoader", () => {
  let loader: TypescriptLoader;
  let context: TestContext;

  beforeEach(async () => {
    loader = new TypescriptLoader();
    context = await makeContext({ pipelines: { "/": [loader] } });
    await linkNodeModules(context.root, "react");
  });

  test.each(["jsx", "mjsx"])("can load JSX from file.%s", async (ext) => {
    await writeFixtures(context.root, {
      [`file.${ext}`]: dedent`
        export const value = "${ext}";

        export default (props) => {
          return <div>{props.children}</div>;
        }
      `,
    });

    const result = await process(`file.${ext}`);

    expect(result).toHaveProperty("value", ext);
    expect(result.content).toBeTypeOf("function");
  });

  test.each(["tsx", "mtsx"])("can load TSX from file.%s", async (ext) => {
    await writeFixtures(context.root, {
      [`file.${ext}`]: dedent`
        export const value: string = "${ext}";

        export default (props: { children?: any }) => {
          return <div>{props.children}</div>;
        }
      `,
    });

    const result = await process(`file.${ext}`);

    expect(result).toHaveProperty("value", ext);
    expect(result.content).toBeTypeOf("function");
  });

  test.each(["js", "mjs"])("can load JS from file.%s", async (ext) => {
    await writeFixtures(context.root, {
      [`file.${ext}`]: dedent`
        export const value = "${ext}";
        export default (props) => \`<div>\${props.children}</div>\`;
      `,
    });

    const result = await process(`file.${ext}`);

    expect(result).toHaveProperty("value", ext);
    expect(result.content).toBeTypeOf("function");
  });

  test.each(["ts", "mts"])("can load TS from file.%s", async (ext) => {
    await writeFixtures(context.root, {
      [`file.${ext}`]: dedent`
        export const value: string = "${ext}";
        export default (props: unknown) => \`<div>\${props.children}</div>\`;
      `,
    });

    const result = await process(`file.${ext}`);

    expect(result).toHaveProperty("value", ext);
    expect(result.content).toBeTypeOf("function");
  });

  const process = async (filename: string) => {
    const processor = new TypescriptLoader();
    const result = await processor.processOne(
      new Datum({
        basePath: context.root,
        filename: path.join(context.root, filename),
      }),
      context,
    );
    if (Array.isArray(result)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    return result.toRecord();
  };
});
