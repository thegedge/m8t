import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";
import { merge } from "../../utils/merge.js";

const processedFor = Symbol.for("processedFor");

/**
 * A loader that loads TypeScript files.
 *
 * The default export is the content, and all other exports form the metadata.
 */
export class TypescriptLoader implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (data[processedFor] === data.filename) {
      return;
    }

    if (!/\.[mc]?[jt]sx?$/.test(data.filename)) {
      return;
    }

    const { default: content, ...otherData } = await import(data.filename);
    return merge(data, otherData, {
      content,
      [processedFor]: data.filename,
    });
  }
}
