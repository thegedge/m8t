import { type Element, renderElementToHTML } from "../jsx.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Processor } from "./index.ts";

// TODO don't use react, just do my own rendering

export class JsxProcessor<DataT extends PageData> implements Processor<DataT> {
  constructor(readonly site: Site) {}

  handles(extension: string) {
    return /^[mc]?[jt]sx$/.test(extension);
  }

  async load(filename: string) {
    // TODO Figure out how to eject from the import cache
    // const key = require.resolve(filename);
    // if (key in require.cache) {
    //   // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    //   delete require.cache[key];
    // }

    const { default: content, ...data } = await import(filename);
    return { data, content };
  }

  async render(content: Element) {
    return await renderElementToHTML(content);
  }
}
