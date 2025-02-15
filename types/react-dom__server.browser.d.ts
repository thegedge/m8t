declare module "react-dom/server.browser" {
  import { ReactNode as Node } from "react";
  import { RenderToReadableStreamOptions } from "react-dom/server";

  export function renderToReadableStream(
    element: Node,
    options?: RenderToReadableStreamOptions,
  ): Promise<
    ReadableStream & {
      allReady: Promise<void>;
    }
  >;
}
