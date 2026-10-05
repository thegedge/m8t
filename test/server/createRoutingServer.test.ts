import { describe, expect, test } from "vitest";

import {
  createRequestHandler,
  createRoutingServer,
  resolveRoute,
  type Routes,
} from "../../src/server/createRoutingServer.js";
import { waitForResponse } from "./helpers.js";

interface TestData extends Record<string, unknown> {
  label: string;
}

describe("resolveRoute", () => {
  describe("literal routes", () => {
    test("matches the root path `/`", () => {
      const root = () => {};
      const match = resolveRoute<TestData>({ "/": root }, "/");

      expect(match).toEqual({ route: root, params: {} });
    });

    test("matches a nested, multi-segment path", () => {
      const post = () => {};
      const routes: Routes<TestData> = {
        "/blog": {
          "/2024": {
            "/hello-world": post,
          },
        },
      };

      const match = resolveRoute(routes, "/blog/2024/hello-world");

      expect(match).toEqual({ route: post, params: {} });
    });

    test("does not match when a literal function segment is not the final segment", () => {
      const routes: Routes<TestData> = { "/file": () => {} };

      expect(resolveRoute(routes, "/file/extra")).toBeUndefined();
    });
  });

  describe("parameterized routes", () => {
    test("captures a single parameterized segment", () => {
      const byId = () => {};
      const routes: Routes<TestData> = { "/users": { "/[id]": byId } };

      const match = resolveRoute(routes, "/users/42");

      expect(match).toEqual({ route: byId, params: { id: "42" } });
    });

    test("captures multiple parameterized segments across levels", () => {
      const action = () => {};
      const routes: Routes<TestData> = {
        "/users": { "/[id]": { "/[action]": action } },
      };

      const match = resolveRoute(routes, "/users/42/edit");

      expect(match).toEqual({ route: action, params: { id: "42", action: "edit" } });
    });
  });

  describe("catchall routes", () => {
    test("captures the remaining path when catchall named", () => {
      const rest = () => {};
      const routes: Routes<TestData> = { "/[...rest]": rest };

      const match = resolveRoute(routes, "/anything/goes/here");

      expect(match).toEqual({ route: rest, params: { rest: "anything/goes/here" } });
    });

    test("captures the remaining path when catchall not named", () => {
      const all = () => {};
      const routes: Routes<TestData> = { "/[...]": all };

      const match = resolveRoute(routes, "/whatever");

      expect(match).toEqual({ route: all, params: { "*": "whatever" } });
    });

    test("falls back to a catchall when a literal function segment is not the final segment", () => {
      const file = () => {};
      const rest = () => {};
      const routes: Routes<TestData> = { "/file": file, "/[...rest]": rest };

      const match = resolveRoute(routes, "/file/extra");

      expect(match).toEqual({ route: rest, params: { rest: "file/extra" } });
    });

    test("prefers the nearest catchall over a more distant ancestor's catchall", () => {
      const exact = () => {};
      const nearest = () => {};
      const farthest = () => {};
      const routes: Routes<TestData> = {
        "/a": {
          "/b": { "/c": exact },
          "/[...nearest]": nearest,
        },
        "/[...farthest]": farthest,
      };

      expect(resolveRoute(routes, "/a/does-not-exist")).toEqual({
        route: nearest,
        params: { nearest: "does-not-exist" },
      });
      expect(resolveRoute(routes, "/elsewhere")).toEqual({
        route: farthest,
        params: { farthest: "elsewhere" },
      });
      expect(resolveRoute(routes, "/a/b/c")).toEqual({
        route: exact,
        params: {},
      });
    });

    test("test", () => {
      const c = () => {};
      const catchall = () => {};
      const routes: Routes<TestData> = {
        "/a": {
          "/b": {
            "/c": c,
          },
          "/[...]": catchall,
        },
      };

      const match = resolveRoute(routes, "/a/b/x");

      expect(match).toEqual({
        route: catchall,
        params: { "*": "b/x" },
      });
    });
  });

  describe("unknown routes", () => {
    test("returns undefined when nothing matches and there is no catchall", () => {
      const routes: Routes<TestData> = { "/known": () => {} };

      expect(resolveRoute(routes, "/unknown")).toBeUndefined();
    });
  });

  describe("path decoding", () => {
    test("URL-decodes a parameterized segment", () => {
      const byTerm = () => {};
      const routes: Routes<TestData> = { "/search": { "/[term]": byTerm } };

      const match = resolveRoute(routes, `/search/${encodeURIComponent("hello world")}`);

      expect(match).toEqual({ route: byTerm, params: { term: "hello world" } });
    });

    test("URL-decodes a literal segment before matching", () => {
      const cafe = () => {};
      const routes: Routes<TestData> = { "/café": cafe };

      const match = resolveRoute(routes, `/${encodeURIComponent("café")}`);

      expect(match).toEqual({ route: cafe, params: {} });
    });
  });
});

describe("createRequestHandler", () => {
  describe("trailing slashes", () => {
    test("redirects a trailing-slash path to its non-trailing-slash equivalent", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/blog": ({ response }) => {
            response.end("blog index");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/blog/");

      expect(response.statusCode).toBe(301);
      expect(response.headers.location).toBe("http://example.test/blog");
    });

    test("does not redirect the root path `/`", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("home");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("home");
    });

    test("does not drop the query string", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/blog": ({ response }) => {
            response.end("blog index");
          },
        },
        { label: "root" },
      );
      const response = await waitForResponse(handler, "/blog/?testing=yes");

      expect(response.statusCode).toBe(301);
      expect(response.headers.location).toBe("http://example.test/blog?testing=yes");
    });
  });

  describe("unknown routes", () => {
    test("returns 404 when nothing matches and there is no catchall", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/known": ({ response }) => {
            response.end("known");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/unknown");

      expect(response.statusCode).toBe(404);
      expect(response.body).toBe("Not found");
    });
  });

  describe("extra data", () => {
    test("passes the extra data provided at server creation through to the route", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": ({ data, response }) => {
            response.end(data.label);
          },
        },
        { label: "hello from extra data" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.body).toBe("hello from extra data");
    });
  });

  describe("async route handlers", () => {
    test("awaits an async route handler before responding", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": async ({ response }) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            response.end("done after awaiting");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.body).toBe("done after awaiting");
    });
  });

  describe("errors thrown from a route", () => {
    test("responds with a server-error body when a route throws synchronously", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": () => {
            throw new Error("boom");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.statusCode).toBe(500);
      expect(response.body).toContain("Internal Server Error");
      expect(response.body).toContain("boom");
    });

    test("responds with a server-error body when an async route rejects", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": async () => {
            await Promise.resolve();
            throw new Error("async boom");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.statusCode).toBe(500);
      expect(response.body).toContain("async boom");
    });

    test("does not attempt to write again if the response already ended before throwing", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/": ({ response }) => {
            response.end("already done");
            throw new Error("too late");
          },
        },
        { label: "root" },
      );

      const response = await waitForResponse(handler, "/");

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("already done");
    });
  });

  describe("request timeout", () => {
    test("responds with a timeout error if the route never settles", async () => {
      const handler = createRequestHandler<TestData>(
        { "/slow": () => new Promise<void>(() => {}) }, // never settles
        { label: "root" },
        { timeout: 20 },
      );

      const response = await waitForResponse(handler, "/slow");

      expect(response.statusCode).toBe(500);
      expect(response.body).toBe("Request timed out");
    });

    test("does not overwrite headers already sent when the timeout fires", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/slow": ({ response }) => {
            response.writeHead(202, { "Content-Type": "text/plain" });
            return new Promise<void>(() => {});
          },
        },
        { label: "root" },
        { timeout: 20 },
      );

      const response = await waitForResponse(handler, "/slow");

      expect(response.statusCode).toBe(202);
      expect(response.body).toBe("Request timed out");
    });

    test("does not respond with a timeout error if the route settles before the timeout", async () => {
      const handler = createRequestHandler<TestData>(
        {
          "/fast": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("fast enough");
          },
        },
        { label: "root" },
        { timeout: 100 },
      );

      const response = await waitForResponse(handler, "/fast");

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("fast enough");
    });
  });
});

describe("createRoutingServer", () => {
  test("serves a real HTTP request end to end", async () => {
    const server = createRoutingServer<TestData>(
      {
        "/": ({ response }) => {
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.end("home");
        },
      },
      { label: "root" },
    );

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Failed to determine server address");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("home");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
