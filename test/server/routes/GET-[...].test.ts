import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Redirects } from "../../../src/server/Redirects.js";
import { defaultRoute } from "../../../src/server/routes/GET-[...].js";
import { makeContext, passthrough, writeFixtures, type TestContext } from "../../helpers.js";
import { waitForM8tResponse } from "../helpers.js";

describe("defaultRoute", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  const serveDefaultRoute = async (path: string, redirects?: Redirects) => {
    return await waitForM8tResponse({
      route: defaultRoute,
      site: context.site,
      redirects,
      request: path,
    });
  };

  test("serves a page's content when its url exactly matches the request path", async () => {
    context = await makeContext({
      pipelines: passthrough([{ url: "/hello", content: "<h1>hi</h1>", mimeType: "text/html" }]),
    });

    const response = await serveDefaultRoute("/hello");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toBe("<h1>hi</h1>");
  });

  test("derives the content type from the url's extension when mimeType isn't set", async () => {
    context = await makeContext({
      pipelines: passthrough([{ url: "/feed.xml", content: "<rss></rss>" }]),
    });

    const response = await serveDefaultRoute("/feed.xml");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/xml");
    expect(response.body).toBe("<rss></rss>");
  });

  test("resolves a directory-style request to that directory's index page", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/blog/index.html", content: "blog index", mimeType: "text/html" },
      ]),
    });

    const response = await serveDefaultRoute("/blog");

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("blog index");
  });

  test("responds with 404 and lists the site's known urls when nothing matches", async () => {
    context = await makeContext({
      pipelines: passthrough([
        { url: "/a", content: "a" },
        { url: "/b", content: "b" },
      ]),
    });

    const response = await serveDefaultRoute("/unknown");

    expect(response.statusCode).toBe(404);
    expect(response.headers["Content-Type"]).toBe("text/plain");
    expect(response.body).toContain("Not found");
    expect(response.body).toContain("path: /unknown");
    expect(response.body).toContain("/a");
    expect(response.body).toContain("/b");
  });

  test("falls back to a static file on disk when no page matches", async () => {
    await writeFixtures(context.root, { "static/robots.txt": "User-agent: *" });

    const response = await serveDefaultRoute("/robots.txt");

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/plain");
    expect(response.headers["Content-Length"]).toBe(Buffer.byteLength("User-agent: *"));
    expect(response.body).toBe("User-agent: *");
  });

  describe("with redirects", () => {
    test("redirects when a redirect rule matches a 3xx status", async () => {
      const redirects = Redirects.fromString("/old /new 301");

      const response = await serveDefaultRoute("/old", redirects);

      expect(response.statusCode).toBe(301);
      expect(response.headers.location).toBe("/new");
      expect(response.body).toBe("");
    });

    test("responds with the redirect's status and an empty body for non-3xx redirect statuses", async () => {
      const redirects = Redirects.fromString("/missing /somewhere 404");

      const response = await serveDefaultRoute("/missing", redirects);

      expect(response.statusCode).toBe(404);
      expect(response.body).toBe("");
    });
  });
});
