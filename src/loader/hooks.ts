import { transformSync } from "esbuild";
import type { LoadFnOutput, LoadHookContext } from "node:module";

const ESBUILD_LOADERS = {
  ".ts": "ts",
  ".mts": "ts",
  ".tsx": "tsx",
  ".jsx": "jsx",
} as const;

type NextLoad = (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput;

/**
 * Compile TypeScript and JSX modules to plain JavaScript.
 *
 * Intended to be registered as an import hook in Node.
 */
export const load = (url: string, context: LoadHookContext, nextLoad: NextLoad): LoadFnOutput => {
  const extension = Object.keys(ESBUILD_LOADERS).find((ext) => url.endsWith(ext)) as
    | keyof typeof ESBUILD_LOADERS
    | undefined;
  if (!extension) {
    return nextLoad(url, context);
  }

  const result = nextLoad(url, { ...context, format: "module" });
  const { code } = transformSync(String(result.source), {
    loader: ESBUILD_LOADERS[extension],
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
};
