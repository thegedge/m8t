import type { Site } from "../Site.ts";
import type { Loader } from "./index.ts";

export class TypescriptLoader implements Loader {
  constructor(readonly site: Site) {}

  handles(filename: string) {
    return /\.[mc]?[jt]sx?$/.test(filename);
  }

  async load(filename: string) {
    const { default: content, ...data } = await import(filename);
    return { ...data, filename, content };
  }
}
