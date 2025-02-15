import { format } from "prettier";
import {
  Children as Children_,
  PropsWithChildren as PropsWithChildren_,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToReadableStream } from "react-dom/server.browser";

export type Element<P = Record<string, never>> = ReactElement<P>;
export type Node = ReactNode;
export type ComponentFunction<P = Record<string, never>> = FunctionComponent<P>;
export type PropsWithChildren<P = Record<string, never>> = PropsWithChildren_<P>;

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

export const toChildArray = (children: ReactNode | ReactNode[]) => {
  return Children_.toArray(children);
};

export const renderElementToHTML = async (element: Node): Promise<string> => {
  const stream = await renderToReadableStream(element);
  await stream.allReady;

  let result = await new Response(stream).text();
  if (Bun.env.NODE_ENV !== "production") {
    result = await format(result, {
      parser: "html",
      // tabWidth: 2,
      // printWidth: 140,
    });
  }

  return result;
};
