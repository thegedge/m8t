import { createHash } from "node:crypto";

import type { BlobCache } from "./index.js"; // oxlint-disable-line no-unused-vars -- used by JSdoc

/**
 * Hash `parts` into a key suitable for a {@link BlobCache}.
 *
 * Each part is length-prefixed, so `cacheKey("ab", "c")` and `cacheKey("a", "bc")` differ. Strings
 * are hashed as their UTF-8 bytes.
 */
export const cacheKey = (...parts: (string | Uint8Array)[]): string => {
  const hash = createHash("sha256");
  for (const part of parts) {
    const length = typeof part == "string" ? Buffer.byteLength(part) : part.byteLength;
    hash.update(`${length}:`).update(part);
  }
  return hash.digest("hex");
};
