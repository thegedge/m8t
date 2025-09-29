import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";

const renderedBy = Symbol.for("renderedBy");

/**
 * A renderer that stringifies the content.
 */
export class StringRenderer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (data[renderedBy]) {
      return;
    }

    return {
      ...data,
      mimeType: data.mimeType || "text/plain",
      content: String(data.content),
      [renderedBy]: this.constructor,
    };
  }
}
