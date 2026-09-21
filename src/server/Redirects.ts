import type { Filesystem } from "../utils/Filesystem.js";

type Redirect = {
  from: URLPattern;
  to: string;
  status: number;
};

/**
 * A collection of redirects for a routing server.
 *
 * Syntax is roughly similar to Netlify's `_redirects` file.
 *
 * @see https://docs.netlify.com/manage/routing/redirects/overview/#syntax-for-the-_redirects-file
 */
export class Redirects {
  public static async fromFilesystem(filesystem: Filesystem, path: string): Promise<Redirects> {
    const contents = await filesystem.readFile(path, "utf8");
    return this.fromString(contents);
  }

  public static fromString(s: string) {
    const redirects: Redirect[] = [];
    for (const line of s.split("\n").map((s) => s.trim())) {
      if (line.length === 0 || line.startsWith("#")) {
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }
      const from = new URLPattern({ pathname: parts[0].replaceAll(/\/\*\b/g, "/:splat(.*)") });
      const to = parts[1];
      const status = parseInt(parts[2] || "301", 10);

      redirects.push({ from, to, status });
    }

    return new Redirects(redirects);
  }

  readonly #redirects: readonly Redirect[];

  constructor(redirects: readonly Redirect[]) {
    this.#redirects = redirects;
  }

  public match(pathname: string): [to: string, status: number] | undefined {
    // TODO consider using URLPattern for matching
    for (const redirect of this.#redirects) {
      if (typeof redirect.from === "string") {
        if (pathname === redirect.from) {
          return [redirect.to, redirect.status];
        }
      } else {
        const match = redirect.from.exec(pathname);
        if (match) {
          const groups = match.pathname.groups || {};
          const to = redirect.to.replaceAll(/:(\w+)/g, (_, key: string) => groups[key] || "");
          return [to, redirect.status];
        }
      }
    }

    return undefined;
  }
}
