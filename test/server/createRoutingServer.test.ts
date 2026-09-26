import { describe, expect, test } from "vitest";

import { createRoutingServer, type Routes } from "../../src/server/createRoutingServer.js";

interface TestData extends Record<string, unknown> {
  label: string;
}

describe("createRoutingServer", () => {
  /**
   * Starts a routing server on an OS-assigned port and returns its base URL alongside an
   * `[Symbol.asyncDispose]` that closes the server, for use with `await using`.
   */
  const serve = async <T extends Record<string, unknown>>(
    routes: Routes<T>,
    data: T,
    options?: { timeout?: number },
  ) => {
    const server = createRoutingServer(routes, data, options);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Failed to determine server address");
    }

    return {
      url: `http://127.0.0.1:${address.port}`,
      [Symbol.asyncDispose]: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  };

  describe("literal routes", () => {
    test("routes the root path `/`", async () => {
      await using server = await serve<TestData>(
        {
          "/": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("home");
          },
        },
        { label: "root" },
      );

      const response = await fetch(server.url + "/");

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("home");
    });

    test("routes a nested, multi-segment path", async () => {
      await using server = await serve<TestData>(
        {
          "/blog": {
            "/2024": {
              "/hello-world": ({ response }) => {
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("a blog post");
              },
            },
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/blog/2024/hello-world`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("a blog post");
    });

    test("does not match when a literal function segment is not the final segment", async () => {
      await using server = await serve<TestData>(
        {
          "/file": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("file handler");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/file/extra`);

      expect(response.status).toBe(404);
    });
  });

  describe("parameterized routes", () => {
    test("captures a single parameterized segment", async () => {
      await using server = await serve<TestData>(
        {
          "/users": {
            "/[id]": ({ params, response }) => {
              response.writeHead(200, { "Content-Type": "application/json" });
              response.end(JSON.stringify(params));
            },
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/users/42`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "42" });
    });

    test("captures multiple parameterized segments across levels", async () => {
      await using server = await serve<TestData>(
        {
          "/users": {
            "/[id]": {
              "/[action]": ({ params, response }) => {
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end(JSON.stringify(params));
              },
            },
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/users/42/edit`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "42", action: "edit" });
    });
  });

  describe("catchall routes", () => {
    test("captures the remaining path when catchall named", async () => {
      await using server = await serve<TestData>(
        {
          "/[...rest]": ({ params, response }) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(params));
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/anything/goes/here`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ rest: "/anything/goes/here" });
    });

    test("captures the remaining path when catchall not named", async () => {
      await using server = await serve<TestData>(
        {
          "/[...]": ({ params, response }) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(params));
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/whatever`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ "*": "/whatever" });
    });

    test("falls back to a catchall when a literal function segment is not the final segment", async () => {
      await using server = await serve<TestData>(
        {
          "/file": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("file handler");
          },
          "/[...rest]": ({ params, response }) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(params));
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/file/extra`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ rest: "/file/extra" });
    });
    test("prefers the nearest catchall over a more distant ancestor's catchall", async () => {
      await using server = await serve<TestData>(
        {
          "/a": {
            "/b": {
              "/c": ({ response }) => {
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("exact match");
              },
            },
            "/[...nearest]": ({ params, response }) => {
              response.writeHead(200, { "Content-Type": "application/json" });
              response.end(JSON.stringify(params));
            },
          },
          "/[...farthest]": ({ params, response }) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(params));
          },
        },
        { label: "root" },
      );

      const nearResponse = await fetch(`${server.url}/a/does-not-exist`);
      expect(nearResponse.status).toBe(200);
      expect(await nearResponse.json()).toEqual({ nearest: "/a/does-not-exist" });

      const farResponse = await fetch(`${server.url}/elsewhere`);
      expect(farResponse.status).toBe(200);
      expect(await farResponse.json()).toEqual({ farthest: "/elsewhere" });

      const exactResponse = await fetch(`${server.url}/a/b/c`);
      expect(exactResponse.status).toBe(200);
      expect(await exactResponse.text()).toBe("exact match");
    });
  });

  describe("trailing slashes", () => {
    test("redirects a trailing-slash path to its non-trailing-slash equivalent", async () => {
      await using server = await serve<TestData>(
        {
          "/blog": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("blog index");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/blog/`, { redirect: "manual" });

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(`${server.url}/blog`);
    });

    test("does not redirect the root path `/`", async () => {
      await using server = await serve<TestData>(
        {
          "/": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("home");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/`, { redirect: "manual" });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("home");
    });

    test("does not drop the query string", async () => {
      await using server = await serve<TestData>(
        {
          "/blog": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("blog index");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/blog/?testing=yes`, { redirect: "manual" });

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(`${server.url}/blog?testing=yes`);
    });
  });

  describe("unknown routes", () => {
    test("returns 404 when nothing matches and there is no catchall", async () => {
      await using server = await serve<TestData>(
        {
          "/known": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("known");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/unknown`);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
    });
  });

  describe("path decoding", () => {
    test("URL-decodes a parameterized segment", async () => {
      await using server = await serve<TestData>(
        {
          "/search": {
            "/[term]": ({ params, response }) => {
              response.writeHead(200, { "Content-Type": "application/json" });
              response.end(JSON.stringify(params));
            },
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/search/${encodeURIComponent("hello world")}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ term: "hello world" });
    });

    test("URL-decodes a literal segment before matching", async () => {
      await using server = await serve<TestData>(
        {
          "/café": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("coffee");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/${encodeURIComponent("café")}`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("coffee");
    });
  });

  describe("extra data", () => {
    test("passes the extra data provided at server creation through to the route", async () => {
      await using server = await serve<TestData>(
        {
          "/": ({ data, response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end(data.label);
          },
        },
        { label: "hello from extra data" },
      );

      const response = await fetch(`${server.url}/`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("hello from extra data");
    });
  });

  describe("async route handlers", () => {
    test("awaits an async route handler before responding", async () => {
      await using server = await serve<TestData>(
        {
          "/": async ({ response }) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("done after awaiting");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("done after awaiting");
    });
  });

  describe("errors thrown from a route", () => {
    test("responds with a server-error body when a route throws synchronously", async () => {
      await using server = await serve<TestData>(
        {
          "/": () => {
            throw new Error("boom");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/`);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).toContain("Internal Server Error");
      expect(text).toContain("boom");
    });

    test("responds with a server-error body when an async route rejects", async () => {
      await using server = await serve<TestData>(
        {
          "/": async () => {
            await Promise.resolve();
            throw new Error("async boom");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/`);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).toContain("Internal Server Error");
      expect(text).toContain("async boom");
    });

    test("does not attempt to write again if the response already ended before throwing", async () => {
      await using server = await serve<TestData>(
        {
          "/": ({ response }) => {
            response.end("already done");
            throw new Error("too late");
          },
        },
        { label: "root" },
      );

      const response = await fetch(`${server.url}/`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("already done");
    });
  });

  describe("request timeout", () => {
    test("responds with a timeout error if the route never settles", async () => {
      await using server = await serve<TestData>(
        {
          "/slow": () => new Promise<void>(() => {}), // never settles
        },
        { label: "root" },
        { timeout: 20 },
      );

      const response = await fetch(`${server.url}/slow`);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Request timed out");
    });

    test("does not overwrite headers already sent when the timeout fires", async () => {
      await using server = await serve<TestData>(
        {
          "/slow": ({ response }) => {
            response.writeHead(202, { "Content-Type": "text/plain" });
            return new Promise<void>(() => {}); // never settles, headers already sent though
          },
        },
        { label: "root" },
        { timeout: 20 },
      );

      const response = await fetch(`${server.url}/slow`);

      // Status is left untouched since headers were already sent, but the response still ends
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("Request timed out");
    });

    test("does not respond with a timeout error if the route settles before the timeout", async () => {
      await using server = await serve<TestData>(
        {
          "/fast": ({ response }) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("fast enough");
          },
        },
        { label: "root" },
        { timeout: 100 },
      );

      const response = await fetch(`${server.url}/fast`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("fast enough");
    });
  });
});
