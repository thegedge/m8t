import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Loader } from "./index.ts";

export class TypescriptLoader<DataT extends PageData> implements Loader<DataT> {
  constructor(readonly site: Site) {}

  handles(filename: string) {
    return /\.[mc]?[jt]sx?$/.test(filename);
  }

  async load(filename: string) {
    const { default: content, ...data } = await import(filename);
    return { filename, data, content };
  }
}
