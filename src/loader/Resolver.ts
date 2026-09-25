import { memoize } from "../utils/memoize.js";

/**
 * A caching wrapper around import.meta.resolve.
 */
export class Resolver {
  #cache: Map<string, string>;

  constructor() {
    if (!metaResolveParentSupported()) {
      throw new Error("m8t requires node to be run with --experimental-import-meta-resolve");
    }
    this.#cache = new Map();
  }

  resolve(specifier: string, parent?: string): string {
    // Key is formed with parent because, for example, `./blah.js` is different based on
    // who's importing it
    const key = parent ? `${parent}/${specifier}` : specifier;
    const cached = this.#cache.get(key);
    if (cached) {
      return cached;
    }

    const resolved = import.meta.resolve(specifier, parent);
    this.#cache.set(key, resolved);
    return resolved;
  }
}

// Ensure import.meta.resolve supports a parent arg.
// For example, node doesn't handle the parent unless --experimental-import-meta-resolve
const metaResolveParentSupported = memoize(() => {
  const PROBE_PARENT = "file:///m8t-probe/parent.js";
  return import.meta.resolve("./probe.js", PROBE_PARENT) === "file:///m8t-probe/probe.js";
});
