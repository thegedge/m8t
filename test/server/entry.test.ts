import { afterEach, describe, expect, test } from "vitest";

import { createSiteHandler } from "../../src/server/entry.js";
import { Redirects } from "../../src/server/Redirects.js";
import { makeContext, passthrough, type TestContext } from "../helpers.js";
import { waitForResponse } from "./helpers.js";

describe("createSiteHandler", () => {
  let context: TestContext;

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("wires the default route to serve a site's page content", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/", content: "hello site" }]) });
    const handler = createSiteHandler(context.site, null);

    const response = await waitForResponse(handler, "/");

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("hello site");
  });

  test("wires the default route to apply redirects", async () => {
    context = await makeContext();
    const handler = createSiteHandler(context.site, Redirects.fromString("/old /new 301"));

    const response = await waitForResponse(handler, "/old");

    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe("/new");
  });

  test("wires the __debug__ index route", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/hello" }]) });
    const handler = createSiteHandler(context.site, null);

    const response = await waitForResponse(handler, "/__debug__");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toContain(`href="/__debug__/${encodeURIComponent("/hello")}"`);
  });

  test("wires the __debug__ per-url route", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/hello" }]) });
    const handler = createSiteHandler(context.site, null);

    const response = await waitForResponse(handler, `/__debug__/${encodeURIComponent("/hello")}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Debug -- /hello");
  });

  test("returns 404 for a path with no matching page, static file, or redirect", async () => {
    context = await makeContext();
    const handler = createSiteHandler(context.site, null);

    const response = await waitForResponse(handler, "/does-not-exist");

    expect(response.statusCode).toBe(404);
  });
});
