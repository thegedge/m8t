import { afterEach, describe, expect, test } from "vitest";

import { Datum, type DatumShape } from "../../../../src/pipeline/Datum.js";
import { debugPageGet } from "../../../../src/server/routes/__debug/GET-[url].js";
import { makeContext, passthrough, type TestContext } from "../../../helpers.js";
import { waitForM8tResponse } from "../../helpers.js";

describe("debugPageGet", () => {
  let context: TestContext | undefined;

  afterEach(async () => {
    await context?.[Symbol.asyncDispose]();
    context = undefined;
  });

  const serveDebugPage = async (context: TestContext, url: string) => {
    return await waitForM8tResponse({
      route: debugPageGet,
      site: context.site,
      params: { url },
    });
  };

  test("responds with 404 when no datum exists for the given url", async () => {
    context = await makeContext({ pipelines: {} });

    const response = await serveDebugPage(context, "/missing");

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe("text/plain");
    expect(response.body).toBe("Not found");
  });

  test("renders the datum's data as JSON when found", async () => {
    context = await makeContext({
      pipelines: passthrough([{ url: "/hello", title: "Hello" }]),
    });

    const response = await serveDebugPage(context, "/hello");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toContain("Debug -- /hello");
    expect(response.body).toContain(`"title":"Hello"`);
    expect(response.body).toContain("<h3>Lineage</h3>");
  });

  test("renders one lineage entry per prior state of the datum", async () => {
    context = await makeContext({
      pipelines: {
        "/": [
          async () => {
            const datum = new Datum<DatumShape>({
              basePath: "/",
              filename: "/page",
              url: "/staged",
            })
              .with({ title: "draft" })
              .with({ title: "final" });
            return [datum];
          },
        ],
      },
    });

    const response = await serveDebugPage(context, "/staged");

    expect(response.statusCode).toBe(200);
    expect(response.body.match(/<details open="open">/g)).toHaveLength(3);
  });

  test("validates the given path", async () => {
    context = await makeContext({
      pipelines: { "/": [] },
    });

    const response = await serveDebugPage(context, "toString");

    expect(response.statusCode).toBe(404);
  });
});
