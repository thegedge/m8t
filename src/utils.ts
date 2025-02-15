/**
 * Normalizes a URL by decoding and encoding its path segments.
 *
 * @param url - The URL to be normalized.
 * @returns The normalized URL.
 */
export const normalizeUrl = (url: string): string => {
  return url
    .split("/")
    .map((v) => encodeURIComponent(decodeURIComponent(v)))
    .join("/");
};
