import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { MaybePromise } from "../index.js";

export type RouteFunction<T> = (options: {
  data: T;
  params: Record<string, string>;
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
}) => MaybePromise<void>;

export interface Routes<T> {
  [key: `/[...]` | `/[...${string}]`]: RouteFunction<T>;
  [key: `/${string}`]: Routes<T> | RouteFunction<T> | undefined;
}

/**
 * Create a server that routes requests based on a given routing map.
 *
 * All routing functions receive an object with the following properties:
 *
 *   - `data`: the additional data, as provided by the user when creating the server;
 *   - `params`: a record of any parameterized path segments;
 *   - `request`: the incoming request; and
 *   - `response`: the outgoing response.
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
 */
export const createRoutingServer = <T extends Record<string, unknown>>(routes: Routes<T>, extraData: T) => {
  return createServer({}, async (request, response) => {
    const url = new URL(request.url ?? "", `https://${request.headers.host}`);
    const path = url.pathname;

    if (path.endsWith("/") && path !== "/") {
      response.writeHead(301, { location: path.slice(0, -1) });
      response.end();
      return;
    }

    const pathSegments = path
      .slice(1)
      .split("/")
      .map((v) => decodeURIComponent(v));

    let catchall = getCatchallRoute(routes);
    let catchallPath = path;

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
        // will still route the path `/a/c` to the fallback route.
        catchall = getCatchallRoute(routesToTry) ?? catchall;
        catchallPath = `/${pathSegment}/${pathSegments.join("/")}`;
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
      params[catchall[0]] = catchallPath;
      route = catchall[1];
    }

    if (!route) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }

    const timeout = setTimeout(() => {
      if (!response.writableEnded) {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "text/plain" });
        }
        response.end("Request timed out");
      }
    }, 10_000); // TODO configurable timeout

    response.on("close", () => {
      clearTimeout(timeout);
    });

    try {
      await route({ data: extraData, params, request, response });
    } catch (error) {
      console.error(error);
      if (!response.writableEnded) {
        if (!response.headersSent) {
          response.writeHead(404, { "Content-Type": "text/plain" });
        }
        response.end(`Internal Server Error\n\n${error.stack}`);
      }
    }
  });
};

const getCatchallRoute = <T>(routes: Routes<T>): [key: string, route: RouteFunction<T>] | undefined => {
  const catchall = Object.entries(routes).find(([key]) => key.startsWith("/[..."));
  if (!catchall) {
    return undefined;
  }

  return [catchall[0].slice(5, -1) || "*", catchall[1]];
};
