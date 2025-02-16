import type { Filesystem } from "./Filesystem.ts";

type Redirect = {
  from: string | RegExp;
  to: string;
  status: number;
};

export class Redirects {
  public static async fromFilesystem(filesystem: Filesystem, path: string): Promise<Redirects> {
    const redirects: Redirect[] = [];
    const contents = await filesystem.readFile(path, "utf8");
    if (contents) {
      for (const line of contents.split("\n")) {
        if (line.trim().length === 0 || line.startsWith("#")) {
          continue;
        }

        const parts = line.split(/\s+/);
        if (parts.length < 2) {
          continue;
        }

        let from: string | RegExp = parts[0];
        let to = parts[1];
        const status = parseInt(parts[2], 10) || 301;

        if (from.includes("/:")) {
          from = new RegExp(from.replaceAll(/\/:(\w+)/g, "/(?:<$1>)"));
          to = to.replaceAll(/\/:(\w+)/g, "/{$1}");
        }

        redirects.push({ from, to, status });
      }
    }

    return new Redirects(redirects);
  }

  constructor(private redirects: readonly Redirect[]) {}

  public match(pathname: string): [to: string, status: number] | undefined {
    for (const redirect of this.redirects) {
      if (typeof redirect.from === "string") {
        if (pathname === redirect.from) {
          return [redirect.to, redirect.status];
        }
      } else {
        const match = pathname.match(redirect.from);
        if (match) {
          const groups = match.groups || {};
          const to = redirect.to.replaceAll(/\{(\w+)\}/g, (_, key: string) => groups[key]);

          // TODO validate `to` has no `{repl}` segments
          return [to, redirect.status];
        }
      }
    }

    return undefined;
  }
}
