import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isPromise } from "node:util/types";
import type { MaybePromise } from "../index.js";

export type RouteFunction<T> = (options: {
  data: T;
  params: Record<string, string>;
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
}) => MaybePromise<void>;

export interface Routes<T> {
  "/*"?: RouteFunction<T>;
  [key: `/${string}`]: Routes<T> | RouteFunction<T> | undefined;
}

export const createRoutingServer = <T extends Record<string, unknown>>(routes: Routes<T>, extraData: T) => {
  return createServer({}, (request, response) => {
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

    let catchall: RouteFunction<T> | undefined = routes["/*"];
    let route: RouteFunction<T> | undefined = undefined;
    let routesToTry = routes;
    let params: Record<string, string> = {};

    while (pathSegments.length > 0) {
      const pathSegment = pathSegments.shift()!;

      let routeHandler = routesToTry[`/${pathSegment}`];
      if (!routeHandler) {
        const paramRoute = Object.entries(routesToTry).find(([key]) => key.startsWith("/:"));
        if (paramRoute) {
          // Slice off the leading `/:`
          params[paramRoute[0].substring(2)] = pathSegment;
          routeHandler = paramRoute[1];
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
        catchall = routesToTry["/*"] ?? catchall;
      } else if (typeof routeHandler === "function") {
        // A literal path segment that resolves to a routing function MUST be the final segment
        if (pathSegments.length == 0) {
          route = routeHandler;
        }
        break;
      } else {
        route = catchall;
        break;
      }
    }

    route ??= catchall;

    if (route) {
      try {
        const result = route({ data: extraData, params, request, response });
        if (isPromise(result)) {
          result.catch((error) => {
            console.error(error);

            if (!response.headersSent) {
              response.writeHead(500, { "content-type": "text/plain" });
              response.end(`Internal Server Error\n\n${error.stack}`);
            }
          });
        }
      } catch (error) {
        console.error(error);

        if (!response.headersSent) {
          response.writeHead(500, { "content-type": "text/plain" });
          response.end(`Internal Server Error\n\n${error.stack}`);
        }
      }
    } else {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    }
  });
};
