import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Validator } from "../../src/utils/Validator.js";
import { makeContext, passthrough, type TestContext } from "../helpers.js";

const VALID_HTML =
  '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body><img src="x.png" alt=""></body></html>';

// Missing `alt` on the `img` fails the `image-alt` a11y rule (currently on by default in Validator)
const INVALID_HTML =
  '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body><img src="x.png"></body></html>';

describe("Validator", () => {
  let context: TestContext;
  let validator: Validator;

  beforeEach(async () => {
    validator = new Validator();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("returns no failures when every html page is valid", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/", mimeType: "text/html", filename: "index.html", content: VALID_HTML },
      ]),
    });

    const summary = await Array.fromAsync(validator.run(context.site));

    expect(summary).toEqual([
      {
        filename: "index.html",
        content: VALID_HTML,
        description: "passed",
        messages: [],
      },
    ]);
  });

  test("reports a failure with results for an invalid page", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/", mimeType: "text/html", filename: "index.html", content: INVALID_HTML },
      ]),
    });

    const summary = await Array.fromAsync(validator.run(context.site));

    expect(summary).toEqual([
      {
        filename: "index.html",
        content: INVALID_HTML,
        description: "failed",
        messages: [
          expect.objectContaining({
            message: '<img> is missing required "alt" attribute',
            ruleId: "wcag/h37",
            selector: "html > body > img",
          }),
        ],
      },
    ]);
  });

  test("skips validation for output paths that aren't html", async () => {
    context = await makeContext({
      pipelines: passthrough([
        {
          url: "/data",
          outputPath: "data.json",
          filename: "data.json",
          content: '{ "data": 1, "stuff": "some content" }',
        },
      ]),
    });

    const summary = await Array.fromAsync(validator.run(context.site));

    expect(summary).toEqual([]);
  });

  test("stops at the first invalid page when failFast is set", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/a", outputPath: "a.html", filename: "a.html", content: INVALID_HTML },
        { url: "/b", outputPath: "b.html", filename: "b.html", content: INVALID_HTML },
      ]),
    });

    const summary = await Array.fromAsync(validator.run(context.site, { failFast: true }));

    expect(summary).toEqual([
      {
        filename: "a.html",
        content: INVALID_HTML,
        description: "failed",
        messages: expect.any(Array),
      },
      {
        filename: "b.html",
        content: INVALID_HTML,
        description: "skipped-fail-fast",
        messages: expect.any(Array),
      },
    ]);
  });

  test("collects failures for every invalid page when failFast is not set", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/a", outputPath: "a.html", filename: "a.html", content: INVALID_HTML },
        { url: "/b", outputPath: "b.html", filename: "b.html", content: INVALID_HTML },
      ]),
    });

    const summary = await Array.fromAsync(validator.run(context.site));

    expect(summary).toEqual([
      {
        filename: "a.html",
        content: INVALID_HTML,
        description: "failed",
        messages: expect.any(Array),
      },
      {
        filename: "b.html",
        content: INVALID_HTML,
        description: "failed",
        messages: expect.any(Array),
      },
    ]);
  });

  test("returns aborted with no failures when the signal is already aborted", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/", mimeType: "text/html", filename: "index.html", content: VALID_HTML },
      ]),
    });

    const signal = AbortSignal.abort();
    const summary = await Array.fromAsync(validator.run(context.site, { signal }));

    expect(summary).toEqual([
      {
        filename: "index.html",
        content: VALID_HTML,
        description: "aborted",
        messages: expect.any(Array),
      },
    ]);
  });
});
