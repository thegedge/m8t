import { afterEach, describe, expect, test } from "vitest";

import { debugGet } from "../../../../src/server/routes/__debug/GET.js";
import { makeContext, passthrough, type TestContext } from "../../../helpers.js";
import { waitForM8tResponse } from "../../helpers.js";

describe("debugGet", () => {
  let context: TestContext;

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("lists a link to every known url", async () => {
    context = await makeContext({
      pipelines: passthrough([{ url: "/a" }, { url: "/b" }]),
    });
    const response = await waitForM8tResponse({ route: debugGet, site: context.site });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toContain(`href="/__debug__/${encodeURIComponent("/a")}"`);
    expect(response.body).toContain(">/a<");
    expect(response.body).toContain(`href="/__debug__/${encodeURIComponent("/b")}"`);
    expect(response.body).toContain(">/b<");
  });

  test("renders without error when there are no known urls", async () => {
    context = await makeContext();

    const response = await waitForM8tResponse({ route: debugGet, site: context.site });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("__debug__/");
  });
});
