import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse,
} from "node:http";

import type { MaybePromise } from "../index.js";

/** A route handler */
export type RouteFunction<T> = (options: {
  data: T;
  params: Record<string, string>;
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
}) => MaybePromise<void>;

/** A set of routes. */
export interface Routes<T> {
  [key: `/[...]` | `/[...${string}]`]: RouteFunction<T>;
  [key: `/${string}`]: Routes<T> | RouteFunction<T> | undefined;
}

/** The result of successfully resolving a path against a routing map. */
export interface RouteMatch<T> {
  /** The route function that should handle the request. */
  route: RouteFunction<T>;

  /** A record of any parameterized (or catchall) path segments captured along the way. */
  params: Record<string, string>;
}

/**
 * Resolve a path against a routing map.
 *
 * This is a pure function: it performs no I/O and knows nothing about HTTP. It exists separately
 * from {@link createRequestHandler} so that the route-matching algorithm (including catchall
 * fallback semantics) can be tested without needing a request or response object.
 *
 * The routing map keys should always start with a forward slash and be a valid URL path segment.
 * They can take one of three forms:
 *
 *   1. A literal path segment;
 *   2. A parameter segment, e.g. `/[param]`;
 *   3. A catchall segment, e.g. `/[...all]`.
 *
 * These then either map to a routing function, if the path segment is the last in the URL, or
 * a nested routing map if the segment is in the middle of a URL.
 *
 * The catchall segment is used when no other route matches the request, if it exists. It is
 * hierarchical in the sense that the nearest catchall route is used, even if it isn't in the
 * current nested route map.
 *
 * @param routes - The routing map to resolve the path against.
 * @param path - The URL path (e.g. `request.url`'s pathname) to resolve.
 *
 * @returns the matched route and any captured params, or `undefined` if nothing matches.
 */
export const resolveRoute = <T>(routes: Routes<T>, path: string): RouteMatch<T> | undefined => {
  const pathSegments = path
    .slice(1)
    .split("/")
    .map((v) => decodeURIComponent(v));

  let catchall = getCatchallRoute(routes);
  let catchallParam = pathSegments.join("/");

  let route: RouteFunction<T> | undefined = undefined;
  let routesToTry = routes;
  let params: Record<string, string> = {};

  while (pathSegments.length > 0) {
    const pathSegment = pathSegments.shift()!;

    let routeHandler = routesToTry[`/${pathSegment}`];
    if (!routeHandler) {
      const parameterizedRoute = Object.entries(routesToTry).find(
        ([key]) => key.startsWith("/[") && !key.startsWith("/[..."),
      );
      if (parameterizedRoute) {
        // Slice off the `/[` and ending `]`
        params[parameterizedRoute[0].slice(2, -1)] = pathSegment;
        routeHandler = parameterizedRoute[1];
      }
    }

    if (typeof routeHandler === "object") {
      routesToTry = routeHandler;

      // Track the closest catchall route as we traverse downwards, in case we don't find a match
      // This means something like the following:
      //
      //   {
      //     "a": {
      //       "b": {
      //         "c": route
      //       }
      //     }
      //     "/*": fallback
      //   }
      //
      // will still route the path `/a/b/x` to the fallback route (with param "b/x")
      const newCatchall = getCatchallRoute(routesToTry);
      if (newCatchall) {
        catchall = newCatchall;
        catchallParam = pathSegments.join("/");
      }
    } else if (typeof routeHandler === "function") {
      // A literal path segment that resolves to a routing function MUST be the final segment
      if (pathSegments.length == 0) {
        route = routeHandler;
      }
      break;
    } else {
      // Will use the catchall below, if one was set
      break;
    }
  }

  if (!route && catchall) {
    params[catchall[0]] = catchallParam;
    route = catchall[1];
  }

  if (!route) {
    return undefined;
  }

  return { route, params };
};

/**
 * Create a `(request, response) => Promise<void>` request handler that routes requests based on a
 * given routing map.
 *
 * This is the part of {@link createRoutingServer} that isn't tied to `node:http`'s `createServer`,
 * so it can be tested directly against lightweight fake request/response objects instead of a real
 * server.
 *
 * All routing functions receive an object with the following properties:
 *
 *   - `data`: the additional data, as provided by the user when creating the server;
 *   - `params`: a record of any parameterized path segments;
 *   - `request`: the incoming request; and
 *   - `response`: the outgoing response.
 *
 * @param timeout - The number of milliseconds to wait for a route to settle before responding
 * with a timeout error (defaults to 10 seconds).
 */
export const createRequestHandler = <T extends Record<string, unknown>>(
  routes: Routes<T>,
  extraData: T,
  { timeout = 10_000 }: { timeout?: number } = {},
): RequestListener => {
  return async (request, response) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    const path = url.pathname;

    if (path.endsWith("/") && path !== "/") {
      url.pathname = path.slice(0, -1);
      response.writeHead(301, { location: url.toString() });
      response.end();
      return;
    }

    response.setTimeout(timeout, () => {
      if (!response.writableEnded) {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "text/plain" });
        }
        response.end("Request timed out");
      }
    });

    const match = resolveRoute(routes, path);
    if (!match) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }

    try {
      await match.route({ data: extraData, params: match.params, request, response });
    } catch (error) {
      console.error(error);
      if (!response.writableEnded) {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "text/plain" });
        }
        response.end(`Internal Server Error\n\n${error.stack}`);
      }
    }
  };
};

/**
 * Create a server that routes requests based on a given routing map.
 *
 * @see createRequestHandler for details on the routing map and the routing functions it maps to.
 *
 * @param timeout - The number of milliseconds to wait for a route to settle before responding
 * with a timeout error (defaults to 10 seconds).
 */
export const createRoutingServer = <T extends Record<string, unknown>>(
  routes: Routes<T>,
  extraData: T,
  options?: { timeout?: number },
) => {
  return createServer({}, createRequestHandler(routes, extraData, options));
};

const getCatchallRoute = <T>(
  routes: Routes<T>,
): [key: string, route: RouteFunction<T>] | undefined => {
  const catchall = Object.entries(routes).find(([key]) => key.startsWith("/[..."));
  if (!catchall) {
    return undefined;
  }

  return [catchall[0].slice(5, -1) || "*", catchall[1]];
};
