import { describe, expect, test } from "vitest";

import { PageDefaultsTransformer } from "../../../../src/index.js";
import { Datum } from "../../../../src/pipeline/Datum.js";
import { combinations } from "../../../../src/utils/combinations.js";
import { makeContext } from "../../../helpers.js";

describe("PageDefaultsTransformer", () => {
  const fields: Record<string, any> = {
    url: "/test/index.html",
    outputPath: "/output/something.html",
    title: "Cool stuff",
    mimeType: "text/json",
    slug: "completely-different",
    date: new Date("2023-03-14T15:22:55Z"),
  };

  const fieldNames = Object.keys(fields);
  const powerSet = Array(fieldNames.length + 1)
    .keys()
    .flatMap((v) => Array.from(combinations(fieldNames, v)))
    .map((names) => ({
      names,
      present: names.length == 0 ? "nothing" : new Intl.ListFormat().format(names),
    }))
    .toArray();

  test.each(powerSet)("fills in values when $present present", async ({ names }) => {
    const datum = new Datum({
      basePath: "/src",
      filename: "/src/blog/2025-05-07-my-post.mdx",
      ...Object.fromEntries(names.map((name) => [name, fields[name]])),
    });

    const processed = await process(datum);

    expect(processed.toRecord()).toMatchObject({
      basePath: "/src",
      filename: "/src/blog/2025-05-07-my-post.mdx",
      outputPath: names.includes("outputPath")
        ? fields.outputPath
        : names.includes("url")
          ? "test/index.html"
          : "blog/2025-05-07-my-post/index.html",
      url: names.includes("url") ? fields.url : "/blog/2025-05-07-my-post",
      title: names.includes("title") ? fields.title : "My Post",
      mimeType: names.includes("mimeType") ? fields.mimeType : "text/html",
      slug: names.includes("slug")
        ? fields.slug
        : names.includes("title")
          ? "cool-stuff"
          : "my-post",
      date: new Date(names.includes("date") ? fields.date : "2025-05-07"),
    });
  });

  test("doesn't clobber an existing date value when filename lacks a date prefix", async () => {
    const date = new Date("1999-01-13");
    const datum = new Datum({
      basePath: "/src",
      filename: "/src/blog/my-post.mdx",
      date,
    });

    const processed = await process(datum);

    expect(processed.get("date")).toEqual(date);
  });

  const process = async (datum: Datum) => {
    const transformer = new PageDefaultsTransformer();
    const context = await makeContext();
    const result = await transformer.processOne(datum, context);
    if (Array.isArray(result)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    return result;
  };
});
