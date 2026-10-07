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

    const siteData = await context.site.load();
    const summary = await validator.validate(siteData.data[0]);

    expect(summary).toEqual({
      filename: "index.html",
      content: VALID_HTML,
      description: "passed",
      messages: [],
    });
  });

  test("reports a warning with results for an invalid page configured to only warn", async () => {
    context = await makeContext({
      pipelines: passthrough([
        {
          url: "/",
          mimeType: "text/html",
          filename: "index.html",
          content: INVALID_HTML,
          htmlValidateRules: { "wcag/h37": "warn" },
        },
      ]),
    });

    const siteData = await context.site.load();
    const summary = await validator.validate(siteData.data[0]);

    expect(summary).toEqual({
      filename: "index.html",
      content: INVALID_HTML,
      description: "warned",
      messages: [
        expect.objectContaining({
          message: '<img> is missing required "alt" attribute',
          ruleId: "wcag/h37",
          selector: "html > body > img",
        }),
      ],
    });
  });

  test("reports a failure with results for an invalid page", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/", mimeType: "text/html", filename: "index.html", content: INVALID_HTML },
      ]),
    });

    const siteData = await context.site.load();
    const summary = await validator.validate(siteData.data[0]);

    expect(summary).toEqual({
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
    });
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

    const siteData = await context.site.load();
    const summary = await validator.validate(siteData.data[0]);

    expect(summary).toEqual(null);
  });

  test("returns aborted with no failures when the signal is already aborted", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/", mimeType: "text/html", filename: "index.html", content: VALID_HTML },
      ]),
    });

    const signal = AbortSignal.abort();
    const siteData = await context.site.load();

    await expect(() => validator.validate(siteData.data[0], { signal })).rejects.toThrow(
      "This operation was aborted",
    );
  });
});
