import { Processor } from ".";
import { Element, renderElementToHTML } from "../jsx";
import type { Site } from "../Site";
import { PageData } from "../types";

// TODO don't use react, just do my own rendering

export class JsxProcessor<DataT extends PageData> implements Processor<DataT> {
  constructor(readonly site: Site) {}

  handles(extension: string) {
    return /^[mc]?[jt]sx$/.test(extension);
  }

  async load(filename: string) {
    const key = require.resolve(filename);
    if (key in require.cache) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete require.cache[key];
    }

    const { default: content, ...data } = await import(filename);
    return { data, content };
  }

  async render(content: Element) {
    return await renderElementToHTML(content);
  }
}
