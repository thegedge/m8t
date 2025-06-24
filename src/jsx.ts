import {
  Children as Children_,
  type PropsWithChildren as PropsWithChildren_,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToReadableStream } from "react-dom/server.browser";

export type Element<P = Record<string, unknown>> = ReactElement<P>;
export type Node = ReactNode;
export type PropsWithChildren<P = Record<string, unknown>> = PropsWithChildren_<P>;

// Copied from @types/react, but removing the Promise<ReactNode> part of the return type (for now)
export interface ComponentFunction<P = {}> {
  (props: P): ReactNode;
  displayName?: string | undefined;
}

export {
  cloneElement,
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useContext,
  type AriaRole,
  type CSSProperties,
  type HTMLProps as HTMLProperties,
} from "react";

export { jsxDEV } from "react/jsx-dev-runtime";
export { jsx, jsxs } from "react/jsx-runtime";

export const toChildArray = (children: ReactNode | ReactNode[]) => {
  return Children_.toArray(children);
};

export const renderElementToHTML = async (element: Node): Promise<string> => {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return await new Response(stream).text();
};
