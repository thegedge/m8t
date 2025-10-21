import type { Site } from "../../Site.js";
import type { RouteFunction } from "../createRoutingServer.js";
import type { Redirects } from "../Redirects.js";

/**
 * A m8t route in a routing server.
 */
export type MateRoute = RouteFunction<{
  site: Site;
  redirects: Redirects | null;
}>;
