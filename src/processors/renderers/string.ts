import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";

/**
 * A renderer that stringifies the content.
 */
export class StringRenderer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if ("mimeType" in data) {
      return;
    }

    return {
      ...data,
      mimeType: "text/plain",
      content: String(data.content),
    };
  }
}
