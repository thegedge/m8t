import { type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.browser";

/**
 * Render a given node to an HTML string.
 *
 * @returns the HTML string.
 */
export const renderElementToHTML = async (element: ReactNode): Promise<string> => {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return await new Response(stream).text();
};
