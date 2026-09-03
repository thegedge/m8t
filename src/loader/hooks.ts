import { transformSync, type Loader } from "esbuild";
import type { LoadHookSync } from "node:module";
import path from "node:path";

/**
 * Compile TypeScript and JSX modules to plain JavaScript.
 *
 * Intended to be registered as an import hook in Node.
 */
export const load: LoadHookSync = (url, context, nextLoad) => {
  if (!URL.canParse(url)) {
    return nextLoad(url, context);
  }

  const resolvedUrl = new URL(url);
  if (resolvedUrl.protocol != "file:") {
    return nextLoad(url, context);
  }

  const extension = path.extname(resolvedUrl.pathname);
  switch (extension) {
    case ".ts":
    case ".mts":
    case ".tsx":
    case ".jsx":
      if (process.features.typescript && (url.endsWith(".ts") || url.endsWith(".mts"))) {
        return nextLoad(url, context);
      }

      const result = nextLoad(url, { ...context, format: "module" });
      return esbuildLoad(url, extension, String(result.source));
    default:
      return nextLoad(url, context);
  }
};

const esbuildLoad = (url: string, extension: ".ts" | ".mts" | ".tsx" | ".jsx", source: string) => {
  let loader: Loader;
  switch (extension) {
    case ".ts":
    case ".mts": {
      loader = "ts";
      break;
    }
    case ".tsx": {
      loader = "tsx";
      break;
    }
    case ".jsx": {
      loader = "jsx";
      break;
    }
    default: {
      const x: never = extension;
      return x;
    }
  }

  const { code } = transformSync(source, {
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
};
