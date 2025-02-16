import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Processor } from "./index.ts";

export class JsProcessor<DataT extends PageData> implements Processor<DataT> {
  constructor(readonly site: Site) {}

  handles(extension: string): boolean {
    return /^[mc]?[jt]s$/.test(extension);
  }

  async load(filename: string) {
    // TODO Figure out how to eject from the import cache
    // const key = require.resolve(filename);
    // if (key in require.cache) {
    //   // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    //   delete require.cache[key];
    // }

    const { default: content, ...data } = await import(filename);
    return {
      data,
      content: typeof content == "function" ? content : () => String(content),
    };
  }

  async render(content: string) {
    return content;
  }
}
