import { type Element, renderElementToHTML } from "../jsx.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Processor } from "./index.ts";

export class JsxProcessor<DataT extends PageData> implements Processor<DataT> {
  constructor(readonly site: Site) {}

  handles(extension: string) {
    return /^[mc]?[jt]sx$/.test(extension);
  }

  async load(filename: string) {
    const { default: content, ...data } = await import(filename);
    return { data, content };
  }

  async render(content: Element) {
    return await renderElementToHTML(content);
  }
}
