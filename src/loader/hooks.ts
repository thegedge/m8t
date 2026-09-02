import { transformSync } from "esbuild";
import type { LoadFnOutput, LoadHookContext } from "node:module";
import path from "node:path";

const ESBUILD_LOADERS = {
  ".ts": "ts",
  ".mts": "ts",
  ".tsx": "tsx",
  ".jsx": "jsx",
} as const;

type LoaderType = (typeof ESBUILD_LOADERS)[keyof typeof ESBUILD_LOADERS];
type NextLoad = (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput;

/**
 * Compile TypeScript and JSX modules to plain JavaScript.
 *
 * Intended to be registered as an import hook in Node.
 */
export const load = (url: string, context: LoadHookContext, nextLoad: NextLoad): LoadFnOutput => {
  if (!URL.canParse(url)) {
    return nextLoad(url, context);
  }

  const resolvedUrl = new URL(url);
  if (resolvedUrl.protocol != "file:") {
    return nextLoad(url, context);
  }

  const extension = path.extname(resolvedUrl.pathname) as keyof typeof ESBUILD_LOADERS;
  const loader: LoaderType = ESBUILD_LOADERS[extension];
  switch (loader) {
    case "ts":
    case "tsx":
    case "jsx": {
      const result = nextLoad(url, { ...context, format: "module" });
      const { code } = transformSync(String(result.source), {
        loader,
        jsx: "automatic",
        jsxDev: true,
        sourcemap: "inline",
        sourcefile: url,
        format: "esm",
      });

      return {
        format: "module",
        source: code,
        shortCircuit: true,
      };
    }
    case undefined:
      return nextLoad(url, context);
  }
};
