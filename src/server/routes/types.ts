import type { Site } from "../../Site.js";
import type { RouteFunction } from "../createRoutingServer.js";
import type { Redirects } from "../Redirects.js";

export type MateRoute = RouteFunction<{
  site: Site;
  redirects: Redirects | null;
}>;
