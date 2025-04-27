import { format } from "prettier";
import {
  Children as Children_,
  type FunctionComponent,
  type PropsWithChildren as PropsWithChildren_,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToReadableStream } from "react-dom/server.browser";

export type Element<P = Record<string, unknown>> = ReactElement<P>;
export type Node = ReactNode;
export type ComponentFunction<P = Record<string, unknown>> = FunctionComponent<P>;
export type PropsWithChildren<P = Record<string, unknown>> = PropsWithChildren_<P>;

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

  let result = await new Response(stream).text();
  if (process.env.NODE_ENV !== "production") {
    result = await format(result, {
      parser: "html",
      tabWidth: 2,
    });
  }

  return result;
};
