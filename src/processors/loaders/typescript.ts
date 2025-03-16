import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A loader that loads TypeScript files.
 *
 * The default export is the content, and all other exports form the metadata.
 */
export class TypescriptLoader implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (data.content) {
      return;
    }

    if (!/\.[mc]?[jt]sx?$/.test(data.filename)) {
      return;
    }

    const { default: content, ...otherData } = await import(data.filename);
    return { ...data, ...otherData, content };
  }
}
