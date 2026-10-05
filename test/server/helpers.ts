import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";

import { Site } from "../../src/index.js";
import type { Redirects } from "../../src/server/Redirects.js";
import type { MateRoute } from "../../src/server/routes/types.js";
import { FakeResponse } from "./FakeResponse.js";

/** A minimal version of `http.IncomingMessage`. */
export const fakeRequest = (options: { url?: string; host?: string } = {}): IncomingMessage =>
  ({
    url: options.url ?? "/",
    headers: { host: options.host ?? "example.test" },
  }) as IncomingMessage;

/** A {@link FakeResponse}, typed as a real `ServerResponse` so it can be passed to routes. */
type FakeServerResponse = FakeResponse & ServerResponse<IncomingMessage>;

/**
 * Wait for an HTTP handler to send a response.
 */
export const waitForResponse = async (
  listener: RequestListener,
  requestOrUrl: IncomingMessage | string,
  response = new FakeResponse(),
): Promise<FakeResponse> => {
  const promise = new Promise<FakeResponse>((resolve, reject) => {
    response.once("finish", () => resolve(response));
    response.once("error", reject);
  });

  listener(
    typeof requestOrUrl == "string" ? fakeRequest({ url: requestOrUrl }) : requestOrUrl,
    response as FakeServerResponse,
  );

  return await promise;
};

/**
 * Wait for a m8t handler to send a response.
 */
export const waitForM8tResponse = async (args: {
  route: MateRoute;
  site: Site;
  redirects?: Redirects;
  params?: Record<string, string>;
  request?: IncomingMessage | string;
  response?: FakeResponse;
}): Promise<FakeResponse> => {
  const {
    route,
    site,
    params = {},
    request,
    redirects = null,
    response = new FakeResponse(),
  } = args;
  const promise = new Promise<FakeResponse>((resolve, reject) => {
    response.once("finish", () => resolve(response));
    response.once("error", reject);
  });

  await route({
    data: {
      site,
      redirects,
    },
    params,
    request: typeof request == "string" ? fakeRequest({ url: request }) : request || fakeRequest(),
    response: response as FakeServerResponse,
  });

  return await promise;
};
