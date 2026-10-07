import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AbortError } from "../../src/errors/AbortError.js";
import { createSiteHandler, run, runServer } from "../../src/server/entry.js";
import { Redirects } from "../../src/server/Redirects.js";
import { Site } from "../../src/site/Site.js";
import { makeContext, passthrough, type TestContext } from "../helpers.js";
import { waitForResponse } from "./helpers.js";

describe("createSiteHandler", () => {
  let context: TestContext;

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("wires the default route to serve a site's page content", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/", content: "hello site" }]) });
    const handler = createSiteHandler(context.site, await context.site.load(), null);

    const response = await waitForResponse(handler, "/");

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("hello site");
  });

  test("wires the default route to apply redirects", async () => {
    context = await makeContext();
    const handler = createSiteHandler(
      context.site,
      await context.site.load(),
      Redirects.fromString("/old /new 301"),
    );

    const response = await waitForResponse(handler, "/old");

    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe("/new");
  });

  test("wires the __debug__ index route", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/hello" }]) });
    const handler = createSiteHandler(context.site, await context.site.load(), null);

    const response = await waitForResponse(handler, "/__debug__");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toContain(`href="/__debug__/${encodeURIComponent("/hello")}"`);
  });

  test("wires the __debug__ per-url route", async () => {
    context = await makeContext({ pipelines: passthrough([{ url: "/hello" }]) });
    const handler = createSiteHandler(context.site, await context.site.load(), null);

    const response = await waitForResponse(handler, `/__debug__/${encodeURIComponent("/hello")}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Debug -- /hello");
  });

  test("returns 404 for a path with no matching page, static file, or redirect", async () => {
    context = await makeContext();
    const handler = createSiteHandler(context.site, await context.site.load(), null);

    const response = await waitForResponse(handler, "/does-not-exist");

    expect(response.statusCode).toBe(404);
  });
});

describe("runServer", () => {
  let context: TestContext;

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("stops loading site data with an AbortError when exiting is aborted", async () => {
    context = await makeContext({
      devServer: { port: await freePort() },
      pipelines: passthrough([{ url: "/" }]),
    });

    const running = runServer(context.site, AbortSignal.abort(new AbortError("sad")));

    await expect(running).rejects.toThrow(AbortError);
    await expect(running).rejects.toThrow("sad");
  });
});

describe("run", () => {
  let controller: AbortController;
  let context: TestContext;

  beforeEach(async () => {
    controller = new AbortController();
    context = await makeContext({ devServer: { port: await freePort() } });

    vi.stubEnv("SITE_ROOT", context.root);
    vi.spyOn(Site, "forRoot").mockImplementation(async (root) => {
      if (root == context.root) {
        return context.site;
      }
      throw new Error(`no site present in ${root}`);
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    controller.abort();
    await context[Symbol.asyncDispose]();
  });

  test("rejects when the port is already in use", async () => {
    const spy = vi.spyOn(process, "send");
    await runServer(context.site, controller.signal);

    await expect(run(controller)).rejects.toThrow(/EADDRINUSE/);

    expect(spy).not.toHaveBeenCalledWith("send:ready");
  });

  test("sends 'ready' only after the server has started listening", async () => {
    const spy = vi.spyOn(process, "send");

    await run(controller);

    await vi.waitFor(() => expect(spy).toHaveBeenCalledExactlyOnceWith("ready"));
  });
});

/** Find a free port by briefly binding to port 0. */
const freePort = async (): Promise<number> => {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "0.0.0.0", () => resolve()));
  const { port } = probe.address() as AddressInfo;
  probe.close();
  return port;
};
